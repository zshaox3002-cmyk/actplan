/**
 * storage.js — 本地存储底层封装（v1.2 架构）
 * 职责：初始化数据结构、底层读写、事务、waitReady
 * Repository 层唯一依赖此文件，禁止页面直接调用 wx.getStorageSync
 *
 * 存储方案：wx.getStorageSync / wx.setStorageSync + JSON
 * - 每个"表"对应一个 Storage key（前缀 db_），值为 JSON 数组
 * - db_meta 存储 id 池和版本号
 */

/** 存储 key 前缀 */
var KEY_PREFIX = 'db_';

/** 内存数据缓存 */
var _tables = null;

/** 云同步模块（由 app.js 通过 setCloudSync 注入） */
var _cloudSync = null;

/** 初始化就绪标志 */
var _ready = false;

/** waitReady 的 resolve 函数 */
var _readyResolve = null;
var _readyPromise = new Promise(function (resolve) {
  _readyResolve = resolve;
});

/**
 * 获取表对应的 Storage key
 * @param {string} name - 表名
 * @returns {string} Storage key
 */
function _key(name) {
  return KEY_PREFIX + name;
}

/**
 * 初始化存储
 * - 首次使用时创建 db_meta、各空表
 * - 后续调用直接从 Storage 加载到内存
 */
function init() {
  if (_ready) return;

  var tableNames = ['customer', 'visit_record', 'plan', 'objection', 'objection_note', 'objection_links', 'operation_log', 'policy', 'segment'];

  _tables = {};

  // 加载或初始化 db_meta
  var meta = wx.getStorageSync(_key('meta'));
  if (!meta) {
    meta = {
      nextId: {},
      version: 1,
      segment_index: {},
      derived_cache: {}
    };
    // 初始化各表 id 计数器
    for (var i = 0; i < tableNames.length; i++) {
      meta.nextId[tableNames[i]] = 0;
    }
    wx.setStorageSync(_key('meta'), meta);
  } else {
    // 补齐旧 meta 缺失的字段
    if (!meta.segment_index) meta.segment_index = {};
    if (!meta.derived_cache) meta.derived_cache = {};
    if (!meta.nextId.policy) meta.nextId.policy = 0;
    if (!meta.nextId.segment) meta.nextId.segment = 0;
  }
  _tables._meta = meta;

  // 加载各业务表
  for (var j = 0; j < tableNames.length; j++) {
    var name = tableNames[j];
    var data = wx.getStorageSync(_key(name));
    if (!data || !Array.isArray(data)) {
      _tables[name] = [];
      wx.setStorageSync(_key(name), []);
    } else {
      _tables[name] = data;
    }
  }

  _ready = true;
  _readyResolve();
  console.log('[Storage] Ready ✓');

  // 数据迁移（仅在版本号低于目标版本时执行）
  _migrate();
}

/**
 * 等待存储初始化完成
 * @returns {Promise<void>}
 */
function waitReady() {
  if (_ready) return Promise.resolve();
  return _readyPromise;
}

/**
 * 检查是否已就绪
 * @returns {boolean}
 */
function isReady() {
  return _ready;
}

/**
 * 获取整表数据（深拷贝，避免外部修改原始数据）
 * @param {string} name - 表名
 * @returns {Array<Object>} 表数据数组
 */
function getTable(name) {
  if (!_ready) throw new Error('[Storage] 存储未初始化');
  if (!_tables[name]) return [];
  return JSON.parse(JSON.stringify(_tables[name]));
}

/**
 * 整表写回
 * @param {string} name - 表名
 * @param {Array<Object>} data - 表数据数组
 */
function setTable(name, data) {
  if (!_ready) throw new Error('[Storage] 存储未初始化');
  _tables[name] = data;
  wx.setStorageSync(_key(name), data);

  // 写入后检查容量
  _checkCapacity(name);

  // 云端同步（异步，不阻塞主流程）
  if (_cloudSync) _cloudSync.uploadTable(name, data);
}

/**
 * 检查 Storage 容量
 * - 超过 800KB → console.warn
 * - 超过 950KB → 通过回调通知上层（app.js 处理）
 * @private
 */
function _checkCapacity(name) {
  try {
    var json = JSON.stringify(_tables[name]);
    // Worst-case UTF-8: 3 bytes per character (avoids O(n) char loop)
    var byteLength = json.length * 3;
    var kbSize = (byteLength / 1024).toFixed(1);

    if (byteLength > 950 * 1024) {
      console.warn('[Storage] ⚠️ 容量严重不足！表 ' + name + ' = ' + kbSize + 'KB，建议立即导出数据');
      // 通知上层
      if (_onCapacityWarning) {
        _onCapacityWarning('critical', name, kbSize);
      }
    } else if (byteLength > 800 * 1024) {
      console.warn('[Storage] ⚠️ 容量预警！表 ' + name + ' = ' + kbSize + 'KB，建议导出数据');
      if (_onCapacityWarning) {
        _onCapacityWarning('warning', name, kbSize);
      }
    }
  } catch (e) {
    // 容量检查失败不影响主流程
    console.error('[Storage] 容量检查失败:', e);
  }
}

/**
 * 注册容量预警回调
 * @param {Function} callback - function(level, tableName, kbSize)
 */
function onCapacityWarning(callback) {
  _onCapacityWarning = callback;
}

/** 容量预警回调 */
var _onCapacityWarning = null;

/**
 * 注入云同步模块
 * @param {Object} module - cloud-sync.js 导出的对象
 */
function setCloudSync(module) {
  _cloudSync = module;
}

/**
 * v1.0 → v1.1 数据迁移
 * 仅当 db_meta.version < 2 时执行，执行后写入 version=2
 * @private
 */
function _migrate() {
  var meta = _tables._meta;
  // 如果已经是 v2 或以上，直接跳到后续迁移
  if ((meta.version || 1) >= 2) {
    _migrateV3();
    return;
  }

  console.log('[Storage] 执行 v1.1 数据迁移...');

  // 1. customer 表：补齐新字段，迁移 coverage_needs → coverage_status
  var customers = _tables.customer;
  var COVERAGE_TYPES = ['重疾', '医疗', '教育金', '养老', '意外', '寿险'];
  var NEEDS_TO_STATUS = {
    '关注中': 'gap',
    '有兴趣': 'gap',
    '待了解': 'gap',
    '暂不考虑': 'none'
  };

  for (var i = 0; i < customers.length; i++) {
    var c = customers[i];
    if (c.is_hnw === undefined) c.is_hnw = false;
    if (c.referral_count === undefined) c.referral_count = 0;
    if (c.birthday === undefined) c.birthday = null;
    if (c.policy_expire_date === undefined) c.policy_expire_date = null;

    if (!c.coverage_status) {
      var status = {};
      for (var k = 0; k < COVERAGE_TYPES.length; k++) {
        var type = COVERAGE_TYPES[k];
        var oldVal = c.coverage_needs && c.coverage_needs[type];
        status[type] = NEEDS_TO_STATUS[oldVal] || 'unknown';
      }
      c.coverage_status = status;
    }
  }
  wx.setStorageSync(_key('customer'), customers);

  // 2. db_segment 初始化：写入 3 条系统预设视图
  var segments = _tables.segment;
  if (segments.length === 0) {
    var now = Date.now();
    var presets = [
      {
        id: meta.nextId.segment++,
        name: '沉睡金子',
        color: null,
        is_system: true,
        rules: {
          version: 1,
          match: 'AND',
          rules: [
            {
              match: 'OR',
              rules: [
                { field: 'total_premium', op: 'gte', value: 50000 },
                { field: 'policy_count', op: 'gte', value: 2 }
              ]
            },
            { field: 'days_since_last_visit', op: 'gte', value: 60 },
            { field: 'stage', op: 'neq', value: '已流失' }
          ]
        },
        sort: { field: 'total_premium', order: 'desc' },
        created_at: now,
        updated_at: now
      },
      {
        id: meta.nextId.segment++,
        name: '重要客户',
        color: null,
        is_system: true,
        rules: {
          version: 1,
          match: 'AND',
          rules: [
            { field: 'is_hnw', op: 'eq', value: true },
            { field: 'intimacy', op: 'gte', value: 4 },
            { field: 'total_premium', op: 'gte', value: 50000 }
          ]
        },
        sort: { field: 'total_premium', order: 'desc' },
        created_at: now,
        updated_at: now
      },
      {
        id: meta.nextId.segment++,
        name: '高价值缺口',
        color: null,
        is_system: true,
        rules: {
          version: 1,
          match: 'AND',
          rules: [
            { field: 'coverage_status_any', op: 'eq', value: 'gap' },
            { field: 'policy_count', op: 'gte', value: 2 }
          ]
        },
        sort: { field: 'total_premium', order: 'desc' },
        created_at: now,
        updated_at: now
      }
    ];
    _tables.segment = presets;
    wx.setStorageSync(_key('segment'), presets);
  }

  // 3. 更新版本号
  meta.version = 2;
  wx.setStorageSync(_key('meta'), meta);
  console.log('[Storage] v1.1 迁移完成 ✓');

  // v1.2 → v1.3 迁移紧接执行（version 已设为 2，_migrateV3 会继续检查）
  _migrateV3();
}

/**
 * v1.2 → v1.3 数据迁移：policy 表补充双轴时间模型字段
 * 仅当 db_meta.version < 3 时执行，执行后写入 version=3
 * @private
 */
function _migrateV3() {
  var meta = _tables._meta;
  if ((meta.version || 1) >= 3) return;

  console.log('[Storage] 执行 v1.3 数据迁移（policy 表双轴时间模型）...');

  // 内联映射，保持 storage.js 独立（不 require policy-templates）
  var PRODUCT_TYPE_TO_CATEGORY = {
    '重疾': 'critical_illness',
    '医疗': 'medical',
    '教育金': 'education',
    '养老': 'annuity',
    '意外': 'accident',
    '寿险': 'whole_life'
  };
  var CATEGORY_TEMPLATES = {
    medical:            { coverage_term: { type: 'years', value: 1 },          payment_term: { type: 'same_as_coverage', value: null } },
    critical_illness:   { coverage_term: { type: 'lifetime', value: null },     payment_term: { type: 'years', value: 20 } },
    term_life:          { coverage_term: { type: 'to_age', value: 60 },         payment_term: { type: 'years', value: 20 } },
    whole_life:         { coverage_term: { type: 'lifetime', value: null },     payment_term: { type: 'years', value: 10 } },
    annuity:            { coverage_term: { type: 'lifetime', value: null },     payment_term: { type: 'single', value: null } },
    accident:           { coverage_term: { type: 'years', value: 1 },          payment_term: { type: 'same_as_coverage', value: null } },
    education:          { coverage_term: { type: 'to_age', value: 18 },        payment_term: { type: 'years', value: 10 } }
  };

  var today = '';
  try {
    var now = new Date();
    var m = now.getMonth() + 1;
    var d = now.getDate();
    today = now.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (d < 10 ? '0' + d : d);
  } catch (e) { today = '2026-01-01'; }

  var policies = _tables.policy;
  for (var i = 0; i < policies.length; i++) {
    var rec = policies[i];
    if (!rec.category) {
      rec.category = PRODUCT_TYPE_TO_CATEGORY[rec.product_type] || 'critical_illness';
    }
    var tmpl = CATEGORY_TEMPLATES[rec.category] || CATEGORY_TEMPLATES.critical_illness;
    if (!rec.coverage_term) rec.coverage_term = tmpl.coverage_term;
    if (!rec.payment_term) rec.payment_term = tmpl.payment_term;
    if (!rec.status) {
      rec.status = (rec.expire_date && rec.expire_date < today) ? 'expired' : 'active';
    }
  }
  wx.setStorageSync(_key('policy'), policies);

  meta.version = 3;
  wx.setStorageSync(_key('meta'), meta);
  console.log('[Storage] v1.3 迁移完成 ✓');
}

/**
 * 获取 meta 数据（直接引用，不深拷贝）
 * @returns {Object} meta 对象
 */
function getMeta() {
  if (!_ready) throw new Error('[Storage] 存储未初始化');
  return _tables._meta;
}

/**
 * 持久化 meta 到 Storage
 */
function persistMeta() {
  wx.setStorageSync(_key('meta'), _tables._meta);

  // 云端同步 meta
  if (_cloudSync) _cloudSync.uploadTable('_meta', _tables._meta);
}

/**
 * 事务执行
 * - 开始时对涉及表做快照
 * - 任一步抛异常时用快照回滚
 * - fn 中使用 getTableRef() 获取直接引用（避免反复深拷贝），修改后用 setTable 写回
 *
 * @param {Function} fn - 事务函数，接收 { getTableRef, setTable } 参数
 */
function transaction(fn) {
  if (!_ready) throw new Error('[Storage] 存储未初始化');

  // 快照
  var snapshot = {};
  for (var name in _tables) {
    snapshot[name] = JSON.parse(JSON.stringify(_tables[name]));
  }

  try {
    fn({
      getTableRef: function (name) {
        return _tables[name];
      },
      setTable: setTable
    });
  } catch (e) {
    // 回滚
    _tables = snapshot;
    for (var tbl in _tables) {
      wx.setStorageSync(_key(tbl), _tables[tbl]);
    }
    console.error('[Storage] 事务失败，已回滚:', e);
    throw e;
  }
}

module.exports = {
  init: init,
  waitReady: waitReady,
  isReady: isReady,
  getTable: getTable,
  setTable: setTable,
  getMeta: getMeta,
  persistMeta: persistMeta,
  transaction: transaction,
  onCapacityWarning: onCapacityWarning,
  setCloudSync: setCloudSync
};

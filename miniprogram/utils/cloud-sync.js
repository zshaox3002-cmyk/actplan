/**
 * cloud-sync.js — 云端备份/恢复模块
 *
 * 架构：本地优先 + 云端备份
 * - 写入路径：本地写入（同步）→ 标记 dirty → 防抖 3s 后上传云端
 * - 失败处理：保留 dirty 标记，onShow/onHide 时自动重试（A+B 组合）
 * - 恢复路径：app 启动时本地为空 → 从云端拉取全量数据
 *
 * 云数据库集合：table_backup
 * 文档结构：{ _openid(系统自动填充), table_name, data, updated_at }
 */

var ENV_ID = 'pro-d1g97lgrm3a7cf83a';
var COLLECTION = 'table_backup';
var DEBOUNCE_MS = 3000;

var _db = null;
var _openid = null;
var _ready = false;

/** 记录哪些表尚未成功同步到云端 */
var _dirty = {};

/** 防抖计时器，key 为表名 */
var _timers = {};

/**
 * 初始化云开发，获取 openid
 * @returns {Promise<void>}
 */
function init() {
  wx.cloud.init({ env: ENV_ID, traceUser: true });
  _db = wx.cloud.database();

  return wx.cloud.callFunction({ name: 'login' })
    .then(function (res) {
      _openid = res.result.openid;
      _ready = true;
      console.log('[CloudSync] Ready ✓ openid:', (_openid || '').slice(0, 8) + '...');
    })
    .catch(function (e) {
      console.error('[CloudSync] 初始化失败，云同步不可用:', e);
      // 不抛出，不阻塞主流程
    });
}

/**
 * 是否已就绪
 * @returns {boolean}
 */
function isReady() {
  return _ready;
}

/**
 * 标记表为 dirty 并触发防抖上传
 * 由 storage.setTable 调用，data 为当前表的最新数据
 * @param {string} name - 表名
 * @param {Array|Object} data - 表数据
 */
function uploadTable(name, data) {
  _dirty[name] = true;
  if (!_ready) return; // 未就绪时只标记 dirty，就绪后由 flushDirty 补传
  _scheduleUpload(name, data);
}

/**
 * 防抖调度上传
 * @private
 */
function _scheduleUpload(name, data) {
  if (_timers[name]) clearTimeout(_timers[name]);
  _timers[name] = setTimeout(function () {
    _doUpload(name, data);
  }, DEBOUNCE_MS);
}

/**
 * 实际执行上传，成功后清除 dirty 标记
 * @private
 */
function _doUpload(name, data) {
  var col = _db.collection(COLLECTION);
  var payload = { data: data, updated_at: Date.now() };

  col.where({ _openid: _openid, table_name: name })
    .get()
    .then(function (res) {
      if (res.data.length > 0) {
        return col.doc(res.data[0]._id).update({ data: payload });
      }
      return col.add({
        data: Object.assign({ table_name: name }, payload)
      });
    })
    .then(function () {
      delete _dirty[name];
      console.log('[CloudSync] 上传成功:', name);
    })
    .catch(function (e) {
      // 保留 dirty，下次 flushDirty 时重试
      console.warn('[CloudSync] 上传失败，保留 dirty:', name, e.errMsg || e);
    });
}

/**
 * 立即重试所有 dirty 表（不防抖）
 * 在 App onShow / onHide 时调用
 * @param {Function} getAllTableData - 返回 { tableName: data } 的函数
 */
function flushDirty(getAllTableData) {
  if (!_ready) return;
  var dirtyNames = Object.keys(_dirty);
  if (dirtyNames.length === 0) return;

  console.log('[CloudSync] flushDirty，重试表:', dirtyNames);
  var allData = getAllTableData();
  dirtyNames.forEach(function (name) {
    if (_timers[name]) {
      clearTimeout(_timers[name]);
      delete _timers[name];
    }
    if (allData[name] !== undefined) {
      _doUpload(name, allData[name]);
    }
  });
}

/**
 * 从云端恢复所有表数据
 * 仅在本地 Storage 为空时（换手机/清缓存）调用
 * @returns {Promise<{tables: Object, meta: Object}|null>} 备份数据，云端无数据时返回 null
 */
function restoreAll() {
  if (!_ready) return Promise.resolve(null);

  return _db.collection(COLLECTION)
    .where({ _openid: _openid })
    .limit(20)
    .get()
    .then(function (res) {
      if (res.data.length === 0) {
        console.log('[CloudSync] 云端无备份数据（新用户）');
        return null;
      }

      var result = { tables: {}, meta: null };
      res.data.forEach(function (doc) {
        if (doc.table_name === '_meta') {
          result.meta = doc.data;
        } else {
          result.tables[doc.table_name] = doc.data;
        }
      });

      console.log('[CloudSync] 恢复数据，表数量:', Object.keys(result.tables).length);
      return result;
    })
    .catch(function (e) {
      console.error('[CloudSync] 恢复失败:', e);
      return null;
    });
}

module.exports = {
  init: init,
  isReady: isReady,
  uploadTable: uploadTable,
  flushDirty: flushDirty,
  restoreAll: restoreAll
};

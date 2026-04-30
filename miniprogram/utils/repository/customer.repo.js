/**
 * customer.repo.js — 客户数据 CRUD
 * 基于 storage.js + id.js，不直接调用 wx.getStorageSync
 */

var storage = require('../storage');
var id = require('../id');
var dateUtil = require('../date');

/**
 * stage 数字/英文 → 中文映射（防御性兜底）
 * DISABLED: stage-number-mapping — stage 字段直接透传中文字符串，不再做数字/英文映射
 */
/* DISABLED: stage-number-mapping
var _STAGE_MAP = {
  1: '需求沟通',
  2: '已成交',
  3: '已拒绝',
  'need': '需求沟通',
  'touch': '初步接触',
  'deal': '已成交',
  'reject': '已拒绝'
};
*/

/**
 * 归一化客户数据：stage 字段直接透传字符串
 * DISABLED: stage-number-mapping — 不再做数字/英文到中文的映射
 * @param {Object} raw - 原始客户数据
 * @returns {Object} 归一化后的客户数据
 */
function _normalizeCustomer(raw) {
  if (!raw) return raw;
  /* DISABLED: stage-number-mapping
  var stage = raw.stage;
  if (typeof stage === 'number' || (typeof stage === 'string' && _STAGE_MAP[stage])) {
    raw.stage = _STAGE_MAP[stage];
  }
  */
  return raw;
}

/**
 * 查询客户列表，支持筛选和搜索
 * @param {Object} [filters] - 筛选条件
 * @param {string} [filters.keyword] - 姓名关键词模糊匹配
 * @param {string} [filters.stage] - 跟进阶段筛选（'全部'不过滤）
 * @returns {Array<Object>} 客户列表
 */
function list(filters) {
  filters = filters || {};
  var all = storage.getTable('customer');

  var normalized = all.map(_normalizeCustomer);

  return normalized
    .filter(function (c) {
      if (filters.keyword) {
        if ((c.name || '').indexOf(filters.keyword) === -1) return false;
      }
      if (filters.stage && filters.stage !== '全部') {
        if (c.stage !== filters.stage) return false;
      }
      return true;
    })
    .sort(function (a, b) {
      // 最近拜访日期降序，未拜访排后面
      var aVisit = a.last_visit || '';
      var bVisit = b.last_visit || '';
      if (aVisit !== bVisit) return bVisit.localeCompare(aVisit);
      return (b.created_at || '').localeCompare(a.created_at || '');
    });
}

/**
 * 根据 ID 获取单个客户
 * @param {number} id - 客户 ID
 * @returns {Object|null} 客户数据或 null
 */
function get(id) {
  var all = storage.getTable('customer');
  for (var i = 0; i < all.length; i++) {
    if (all[i].id === id) return _normalizeCustomer(all[i]);
  }
  return null;
}

/**
 * 新建客户
 * @param {Object} data - 客户数据
 * @param {string} data.name - 客户姓名（必填）
 * @returns {Object} 执行结果，含 id
 */
function create(data) {
  var all = storage.getTable('customer');
  var newId = id.nextId('customer');
  var now = dateUtil.nowISO();

  var customer = {
    id: newId,
    name: data.name || '',
    gender: data.gender || '',
    relation: data.relation || '',
    income: data.income || '',
    age_range: data.age_range || '',
    occupation: data.occupation || '',
    residence: data.residence || '',
    marital: data.marital || '',
    intimacy: data.intimacy || '',
    stage: data.stage || '需求沟通',
    stage_updated_at: data.stage_updated_at || null,
    tags: data.tags || [],
    coverage_needs: data.coverage_needs || {},
    /* DISABLED: field-removed - 暂时禁用，保留备用
    follow_date: data.follow_date || null,
    todo_task: data.todo_task || '',
    objection_legacy: data.objection_legacy || '',
    apple_rank_overridden: data.apple_rank_overridden || 0,
    */
    family: data.family || '',
    has_need: data.has_need || '不确定',
    has_ability: data.has_ability || '不确定',
    is_decider: data.is_decider || '不确定',
    coverage_gap: data.coverage_gap || '',
    /* DISABLED: field-removed - 暂时禁用，保留备用
    coverage: data.coverage || [],
    gap: data.gap || [],
    */
    last_visit: data.last_visit || null,
    visit_count: data.visit_count || 0,
    created_at: now,
    updated_at: now
  };

  all.push(customer);
  storage.setTable('customer', all);

  return { id: newId };
}

/**
 * 更新客户信息
 * - 若 stage 字段变化，同步更新 stage_updated_at
 * - 自动更新 updated_at
 *
 * @param {number} id - 客户 ID
 * @param {Object} data - 要更新的字段
 * @returns {boolean} 是否成功
 */
function update(id, data) {
  var all = storage.getTable('customer');
  var found = false;

  for (var i = 0; i < all.length; i++) {
    if (all[i].id === id) {
      // stage 字段直接透传（不再做数字/英文映射）
      /* DISABLED: stage-number-mapping
      if (data.stage) {
        data.stage = _STAGE_MAP[data.stage] || data.stage;
      }
      */
      // 检测 stage 是否变化
      if (data.stage && data.stage !== all[i].stage) {
        data.stage_updated_at = dateUtil.nowISO();
      }

      // 合并更新字段
      for (var key in data) {
        if (data[key] !== undefined) {
          all[i][key] = data[key];
        }
      }
      all[i].updated_at = dateUtil.nowISO();
      found = true;
      break;
    }
  }

  if (found) {
    storage.setTable('customer', all);
  }
  return found;
}

/**
 * 删除客户（级联清理关联的拜访计划和拜访记录）
 * @param {number} id - 客户 ID
 * @returns {boolean} 是否成功
 */
function deleteCustomer(id) {
  var all = storage.getTable('customer');
  var originalLen = all.length;
  var filtered = all.filter(function (c) { return c.id !== id; });
  if (filtered.length < originalLen) {
    storage.setTable('customer', filtered);

    // 级联删除关联的拜访计划
    var plans = storage.getTable('plan');
    var remainingPlans = plans.filter(function (p) { return p.customer_id !== id; });
    if (remainingPlans.length < plans.length) {
      storage.setTable('plan', remainingPlans);
    }

    // 级联删除关联的拜访记录
    var records = storage.getTable('visit_record');
    var remainingRecords = records.filter(function (r) { return r.customer_id !== id; });
    if (remainingRecords.length < records.length) {
      storage.setTable('visit_record', remainingRecords);
    }

    return true;
  }
  return false;
}

/**
 * 获取客户总量
 * @returns {number} 客户总数
 */
function count() {
  if (!storage.isReady()) return 0;
  return storage.getTable('customer').length;
}

module.exports = {
  list: list,
  get: get,
  create: create,
  update: update,
  delete: deleteCustomer,
  count: count
};

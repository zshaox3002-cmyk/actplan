/**
 * policy.repo.js — 保单数据 CRUD（v1.1 新增）
 * 管理 db_policy 表，source='self' 由成交流程自动创建，source='external' 由用户手动录入
 */

var storage = require('../storage');
var id = require('../id');

/**
 * 获取指定客户的全部保单，按 effective_date 降序
 * @param {number} customerId
 * @returns {Array<Object>}
 */
function list(customerId) {
  var all = storage.getTable('policy');
  return all
    .filter(function (p) { return p.customer_id === customerId; })
    .sort(function (a, b) {
      return (b.effective_date || '').localeCompare(a.effective_date || '');
    });
}

/**
 * 新建保单记录
 * @param {Object} data
 * @param {number} data.customer_id
 * @param {string} data.product_type - 险种枚举（重疾/医疗/教育金/养老/意外/寿险）
 * @param {string} [data.product_name]
 * @param {number} data.premium - 年缴保费（元）
 * @param {string} data.effective_date - YYYY-MM-DD
 * @param {string} [data.expire_date]
 * @param {string} data.source - 'self' | 'external'
 * @param {number|null} [data.visit_record_id]
 * @returns {Object} 新建的保单记录
 */
function create(data) {
  var all = storage.getTable('policy');
  var newId = id.nextId('policy');

  var policy = {
    id: newId,
    customer_id: data.customer_id,
    product_type: data.product_type,
    product_name: data.product_name || '',
    premium: data.premium,
    effective_date: data.effective_date,
    expire_date: data.expire_date || null,
    source: data.source,
    visit_record_id: data.visit_record_id || null,
    created_at: Date.now()
  };

  all.push(policy);
  storage.setTable('policy', all);

  // 失效该客户的派生字段缓存
  _invalidateDerivedCache(data.customer_id);

  return policy;
}

/**
 * 更新保单
 * - source='external'：可更新 product_name / premium / effective_date / expire_date / product_type
 * - source='self'：仅可更新 product_name
 * @param {number} policyId
 * @param {Object} fields
 * @returns {boolean}
 */
function update(policyId, fields) {
  var all = storage.getTable('policy');
  var found = false;

  for (var i = 0; i < all.length; i++) {
    if (all[i].id === policyId) {
      var policy = all[i];
      if (policy.source === 'self') {
        // self 保单只允许更新 product_name
        if (fields.product_name !== undefined) {
          policy.product_name = fields.product_name;
        }
      } else {
        // external 保单可更新核心字段
        var editableFields = ['product_name', 'product_type', 'premium', 'effective_date', 'expire_date'];
        for (var k = 0; k < editableFields.length; k++) {
          var f = editableFields[k];
          if (fields[f] !== undefined) policy[f] = fields[f];
        }
      }
      found = true;
      break;
    }
  }

  if (found) {
    storage.setTable('policy', all);
  }
  return found;
}

/**
 * 删除保单
 * @param {number} policyId
 * @returns {{ success: boolean, deletedPolicy: Object|null }} 返回被删除的保单，供调用方判断是否回滚 coverage_status
 */
function remove(policyId) {
  var all = storage.getTable('policy');
  var deletedPolicy = null;

  var remaining = all.filter(function (p) {
    if (p.id === policyId) {
      deletedPolicy = p;
      return false;
    }
    return true;
  });

  if (!deletedPolicy) return { success: false, deletedPolicy: null };

  storage.setTable('policy', remaining);
  _invalidateDerivedCache(deletedPolicy.customer_id);

  return { success: true, deletedPolicy: deletedPolicy };
}

/**
 * 聚合派生字段：policy_count / total_premium / avg_premium / first_policy_date
 * @param {number} customerId
 * @returns {{ policy_count: number, total_premium: number, avg_premium: number, first_policy_date: string|null }}
 */
function getDerived(customerId) {
  // 命中缓存时直接返回
  var meta = storage.getMeta();
  var cache = meta.derived_cache || {};
  if (cache[customerId]) return cache[customerId];

  var policies = list(customerId);
  var count = policies.length;
  var total = 0;
  var firstDate = null;

  for (var i = 0; i < policies.length; i++) {
    total += policies[i].premium || 0;
    var d = policies[i].effective_date;
    if (d && (!firstDate || d < firstDate)) firstDate = d;
  }

  var derived = {
    policy_count: count,
    total_premium: total,
    avg_premium: count > 0 ? Math.round(total / count) : 0,
    first_policy_date: firstDate
  };

  // 写入缓存
  cache[customerId] = derived;
  meta.derived_cache = cache;
  storage.persistMeta();

  return derived;
}

/**
 * 批量聚合所有客户的派生字段（客户列表页使用，避免 N 次循环读）
 * @returns {Object} { [customerId]: derived }
 */
function getDerivedAll() {
  var all = storage.getTable('policy');
  var map = {};

  for (var i = 0; i < all.length; i++) {
    var p = all[i];
    var cid = p.customer_id;
    if (!map[cid]) {
      map[cid] = { policy_count: 0, total_premium: 0, first_policy_date: null };
    }
    map[cid].policy_count++;
    map[cid].total_premium += p.premium || 0;
    var d = p.effective_date;
    if (d && (!map[cid].first_policy_date || d < map[cid].first_policy_date)) {
      map[cid].first_policy_date = d;
    }
  }

  for (var cid2 in map) {
    var m = map[cid2];
    m.avg_premium = m.policy_count > 0 ? Math.round(m.total_premium / m.policy_count) : 0;
  }

  return map;
}

/**
 * 失效指定客户的派生字段缓存
 * @param {number} customerId
 * @private
 */
function _invalidateDerivedCache(customerId) {
  var meta = storage.getMeta();
  if (meta.derived_cache && meta.derived_cache[customerId]) {
    delete meta.derived_cache[customerId];
    storage.persistMeta();
  }
}

module.exports = {
  list: list,
  create: create,
  update: update,
  remove: remove,
  getDerived: getDerived,
  getDerivedAll: getDerivedAll
};

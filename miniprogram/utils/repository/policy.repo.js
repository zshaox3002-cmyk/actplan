/**
 * policy.repo.js — 保单数据 CRUD（v1.1 新增，v1.3 双轴时间模型扩展）
 * 管理 db_policy 表
 */

var storage = require('../storage');
var id = require('../id');
var templates = require('../policy-templates');
var policyCompute = require('../policy-compute');
var dateUtil = require('../date');

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
 * @param {string} [data.product_type] - 旧险种枚举，与 category 二选一
 * @param {string} [data.category] - 险种 enum（优先使用）
 * @param {string} [data.product_name]
 * @param {number} data.premium - 年缴保费（元）
 * @param {string} data.effective_date - YYYY-MM-DD
 * @param {string} [data.expire_date] - 保留向后兼容，通常为 null
 * @param {Object} [data.coverage_term]
 * @param {Object} [data.payment_term]
 * @param {string} [data.status] - draft/active/expired
 * @param {number|null} [data.visit_record_id]
 * @returns {Object} 新建的保单记录
 */
function create(data) {
  var all = storage.getTable('policy');
  var newId = id.nextId('policy');

  var category = data.category || templates.inferCategoryFromProductType(data.product_type || '');
  var tmpl = templates.getTemplate(category);

  var policy = {
    id: newId,
    customer_id: data.customer_id,
    insured_member_id: data.insured_member_id !== undefined ? data.insured_member_id : null,
    product_type: data.product_type || templates.getCoverageKey(category),
    category: category,
    product_name: data.product_name || '',
    premium: data.premium,
    effective_date: data.effective_date,
    expire_date: data.expire_date || null,
    coverage_term: data.coverage_term || tmpl.coverage_term,
    payment_term: data.payment_term || tmpl.payment_term,
    status: data.status || 'active',
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
      var editableFields = [
        'product_name', 'product_type', 'category',
        'premium', 'effective_date', 'expire_date',
        'coverage_term', 'payment_term', 'status', 'insured_member_id'
      ];
      for (var k = 0; k < editableFields.length; k++) {
        var f = editableFields[k];
        if (fields[f] !== undefined) policy[f] = fields[f];
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
    first_policy_date: firstDate,
    yearly_pending_premium: policyCompute.computeYearlyPendingPremium(policies, dateUtil.today())
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
 * 获取保单列表并附加运行时计算字段（供 customer-detail 使用）
 * @param {number} customerId
 * @returns {Array<Object>} 每条保单附加 _category/_coverage_term/_payment_term/
 *   _expiry_date/_next_payment_date/_payment_end_date/_card_status/_policy_year/_policy_summary
 */
function listWithComputed(customerId) {
  var policies = list(customerId);
  var today = dateUtil.today();

  return policies.map(function (p) {
    var cat = p.category || templates.inferCategoryFromProductType(p.product_type || '');
    var tmpl = templates.getTemplate(cat);
    var ct = p.coverage_term || tmpl.coverage_term;
    var pt = p.payment_term || tmpl.payment_term;

    var expiryDate = policyCompute.computeExpiryDate(p.effective_date, ct);
    var nextPaymentDate = policyCompute.computeNextPaymentDate(p.effective_date, pt);
    var paymentEndDate = policyCompute.computePaymentEndDate(p.effective_date, pt);
    var cardStatus = policyCompute.computePolicyCardStatus(p, today);
    var policyYear = policyCompute.computePolicyYear(p.effective_date);
    var policySummary = templates.formatPolicySummary(ct, pt, tmpl.show_payment_term);
    // 通过完成记录快速录入的保单缺少 effective_date，需在卡片提示补充
    var needsCompletion = !p.effective_date || !p.premium;

    var result = {};
    for (var k in p) { result[k] = p[k]; }
    result._category = cat;
    result._coverage_term = ct;
    result._payment_term = pt;
    result._expiry_date = expiryDate;
    result._next_payment_date = nextPaymentDate;
    result._payment_end_date = paymentEndDate;
    result._card_status = cardStatus;
    result._policy_year = policyYear;
    result._policy_summary = policySummary;
    result._needs_completion = needsCompletion;
    return result;
  });
}

/**
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
  listWithComputed: listWithComputed,
  create: create,
  update: update,
  remove: remove,
  getDerived: getDerived,
  getDerivedAll: getDerivedAll
};

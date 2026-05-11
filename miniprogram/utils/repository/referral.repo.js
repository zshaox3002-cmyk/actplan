/**
 * referral.repo.js — 转介绍关系 CRUD
 * 基于 storage.js，不直接调用 wx.getStorageSync
 * 每个客户只能有一个来源（一条入边关系），但可以介绍多个人（多条出边关系）
 */

var storage = require('../storage');
var id = require('../id');
var dateUtil = require('../date');

/**
 * 创建转介绍关系
 * @param {number} referrerCustomerId - 发起转介绍的客户 ID
 * @param {number} referredCustomerId - 被介绍的新客户 ID
 * @param {Object} [options]
 * @param {string} [options.source] - 来源标记，默认 'customer_create'
 * @param {string} [options.note] - 备注
 * @returns {Object} 新创建的关系对象
 */
function createRelation(referrerCustomerId, referredCustomerId, options) {
  options = options || {};
  var all = storage.getTable('referral_relation');
  var newId = id.nextId('referral_relation');
  var now = dateUtil.nowISO();

  var relation = {
    id: newId,
    referrer_customer_id: referrerCustomerId,
    referred_customer_id: referredCustomerId,
    created_at: now,
    updated_at: now,
    note: options.note || '',
    source: options.source || 'customer_create'
  };

  all.push(relation);
  storage.setTable('referral_relation', all);
  return relation;
}

/**
 * 更新转介绍关系的介绍人（被介绍客户改换介绍人）
 * @param {number} referredCustomerId - 被介绍客户 ID
 * @param {number} newReferrerCustomerId - 新的介绍人 ID
 * @returns {boolean} 是否成功
 */
function updateRelation(referredCustomerId, newReferrerCustomerId) {
  var all = storage.getTable('referral_relation');
  var found = false;
  for (var i = 0; i < all.length; i++) {
    if (all[i].referred_customer_id === referredCustomerId) {
      all[i].referrer_customer_id = newReferrerCustomerId;
      all[i].updated_at = dateUtil.nowISO();
      found = true;
      break;
    }
  }
  if (found) storage.setTable('referral_relation', all);
  return found;
}

/**
 * 删除某个被介绍客户的入边关系
 * @param {number} referredCustomerId - 被介绍客户 ID
 * @returns {number|null} 被删关系的 referrer_customer_id，无则 null
 */
function removeByReferredCustomer(referredCustomerId) {
  var all = storage.getTable('referral_relation');
  var removedReferrerId = null;
  var remaining = all.filter(function (r) {
    if (r.referred_customer_id === referredCustomerId) {
      removedReferrerId = r.referrer_customer_id;
      return false;
    }
    return true;
  });
  if (remaining.length < all.length) {
    storage.setTable('referral_relation', remaining);
  }
  return removedReferrerId;
}

/**
 * 删除某个介绍人的所有出边关系（删除客户时级联调用）
 * @param {number} referrerId - 介绍人客户 ID
 * @returns {Array<number>} 被置孤的 referredCustomerId 列表
 */
function removeByReferrer(referrerId) {
  var all = storage.getTable('referral_relation');
  var orphanedIds = [];
  var remaining = all.filter(function (r) {
    if (r.referrer_customer_id === referrerId) {
      orphanedIds.push(r.referred_customer_id);
      return false;
    }
    return true;
  });
  if (remaining.length < all.length) {
    storage.setTable('referral_relation', remaining);
  }
  return orphanedIds;
}

/**
 * 获取某介绍人介绍的所有客户 ID 列表
 * @param {number} referrerId - 介绍人客户 ID
 * @returns {Array<number>} 被介绍客户 ID 数组
 */
function listByReferrer(referrerId) {
  var all = storage.getTable('referral_relation');
  var result = [];
  for (var i = 0; i < all.length; i++) {
    if (all[i].referrer_customer_id === referrerId) {
      result.push(all[i].referred_customer_id);
    }
  }
  return result;
}

/**
 * 获取某客户的入边介绍关系（每个客户最多一条）
 * @param {number} referredCustomerId - 被介绍客户 ID
 * @returns {Object|null} 关系对象或 null
 */
function getByReferred(referredCustomerId) {
  var all = storage.getTable('referral_relation');
  for (var i = 0; i < all.length; i++) {
    if (all[i].referred_customer_id === referredCustomerId) {
      return all[i];
    }
  }
  return null;
}

/**
 * 组装转介绍网络数据（供 referral-network 页面直接使用）
 * @param {number} customerId - 当前客户 ID
 * @returns {{ current: Object, upstream: Object|null, downstream: Array<Object> }}
 */
function getNetwork(customerId) {
  var customerRepo = require('./customer.repo');
  var policyRepo = require('./policy.repo');

  var current = customerRepo.get(customerId);
  if (!current) return { current: null, upstream: null, downstream: [] };

  // 上游：谁介绍了当前客户
  var upstreamRelation = getByReferred(customerId);
  var upstream = null;
  if (upstreamRelation) {
    var upstreamCustomer = customerRepo.get(upstreamRelation.referrer_customer_id);
    if (upstreamCustomer) {
      upstream = {
        relation_id: upstreamRelation.id,
        customer_id: upstreamCustomer.id,
        name: upstreamCustomer.name,
        stage: upstreamCustomer.stage
      };
    }
  }

  // 下游：当前客户介绍了哪些人
  var downstreamIds = listByReferrer(customerId);
  var downstream = [];
  for (var i = 0; i < downstreamIds.length; i++) {
    var c = customerRepo.get(downstreamIds[i]);
    if (!c) continue;
    var derived = policyRepo.getDerived(c.id);
    downstream.push({
      relation_id: null,
      customer_id: c.id,
      name: c.name,
      stage: c.stage,
      last_visit: c.last_visit,
      policy_count: derived.policy_count || 0,
      total_premium: derived.total_premium || 0
    });
  }

  return {
    current: { id: current.id, name: current.name, stage: current.stage, referral_count: current.referral_count || 0 },
    upstream: upstream,
    downstream: downstream
  };
}

/**
 * 检查将 referrerCandidateId 设为 referredCustomerId 的介绍人是否会形成循环
 * 循环定义：referredCustomerId 是 referrerCandidateId 的（直接或间接）介绍人
 * @param {number} referrerCandidateId - 候选介绍人 ID
 * @param {number} referredCustomerId - 被介绍客户 ID
 * @returns {boolean} true 表示会形成循环
 */
function isCircular(referrerCandidateId, referredCustomerId) {
  // 从候选介绍人向上追溯，若能追到 referredCustomerId 则有循环
  var visited = {};
  var current = referrerCandidateId;
  var maxDepth = 50; // 防止异常数据导致死循环
  for (var depth = 0; depth < maxDepth; depth++) {
    if (current === referredCustomerId) return true;
    if (visited[current]) break;
    visited[current] = true;
    var relation = getByReferred(current);
    if (!relation) break;
    current = relation.referrer_customer_id;
  }
  return false;
}

/**
 * 根据 referral_relation 表重算并写回某客户的 referral_count
 * @param {number} customerId - 客户 ID
 */
function recountReferralCount(customerId) {
  var customerRepo = require('./customer.repo');
  var count = listByReferrer(customerId).length;
  customerRepo.update(customerId, { referral_count: count });
}

module.exports = {
  createRelation: createRelation,
  updateRelation: updateRelation,
  removeByReferredCustomer: removeByReferredCustomer,
  removeByReferrer: removeByReferrer,
  listByReferrer: listByReferrer,
  getByReferred: getByReferred,
  getNetwork: getNetwork,
  isCircular: isCircular,
  recountReferralCount: recountReferralCount
};

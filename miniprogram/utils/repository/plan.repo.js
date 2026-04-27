/**
 * plan.repo.js — 拜访计划 CRUD
 * 基于 storage.js + id.js，不直接调用 wx.getStorageSync
 */

var storage = require('../storage');
var id = require('../id');
var dateUtil = require('../date');
var constants = require('../constants');

/**
 * 查询指定日期的计划列表
 * @param {string} date - 日期 'YYYY-MM-DD'
 * @returns {Array<Object>} 计划列表（按创建时间排序）
 */
function list(date) {
  var all = storage.getTable('plan');
  return all
    .filter(function (p) { return p.plan_date === date; })
    .sort(function (a, b) { return (a.created_at || '').localeCompare(b.created_at || ''); });
}

/**
 * 查询指定周的所有计划
 * @param {string} anchorDate - 锚点日期
 * @returns {Array<Object>} 计划列表
 */
function listWeek(anchorDate) {
  var range = dateUtil.getWeekRange(anchorDate);
  var all = storage.getTable('plan');
  return all
    .filter(function (p) { return p.plan_date >= range[0] && p.plan_date <= range[1]; })
    .sort(function (a, b) { return (a.plan_date || '').localeCompare(b.plan_date || ''); });
}

/**
 * 获取指定周已有计划的客户 ID 列表
 * @param {string} anchorDate - 锚点日期
 * @returns {Array<number>} 客户 ID 数组
 */
function listCustomerIdsInWeek(anchorDate) {
  var plans = listWeek(anchorDate);
  var ids = [];
  for (var i = 0; i < plans.length; i++) {
    var cid = plans[i].customer_id;
    if (cid && ids.indexOf(cid) === -1) {
      ids.push(cid);
    }
  }
  return ids;
}

/**
 * 新建拜访计划
 * - 检测同客户同日是否已有计划，返回冲突标记
 * - 同日多次添加走业务层弹窗提示，不阻止插入
 *
 * @param {Object} data - 计划数据
 * @param {number} data.customer_id - 关联客户 ID
 * @param {string} data.plan_date - 计划日期 'YYYY-MM-DD'
 * @param {string} data.visit_way - 拜访方式
 * @returns {{ id: number, conflict: boolean }} 新计划 ID 和冲突标记
 */
function create(data) {
  var all = storage.getTable('plan');

  // 检测同客户同日是否已有计划
  var conflict = false;
  for (var i = 0; i < all.length; i++) {
    if (all[i].customer_id === data.customer_id && all[i].plan_date === data.plan_date) {
      conflict = true;
      break;
    }
  }

  var newId = id.nextId('plan');
  var now = dateUtil.nowISO();

  var plan = {
    id: newId,
    customer_id: data.customer_id,
    plan_date: data.plan_date,
    visit_way: data.visit_way || constants.VISIT_WAY.FACE,
    status: constants.PLAN_STATUS.PENDING,
    created_at: now
  };

  all.push(plan);
  storage.setTable('plan', all);

  return { id: newId, conflict: conflict };
}

/**
 * 标记计划为已完成
 * @param {number} planId - 计划 ID
 * @returns {boolean} 是否成功
 */
function complete(planId) {
  var all = storage.getTable('plan');
  var found = false;
  for (var i = 0; i < all.length; i++) {
    if (all[i].id === planId) {
      all[i].status = constants.PLAN_STATUS.COMPLETED;
      found = true;
      break;
    }
  }
  if (found) {
    storage.setTable('plan', all);
  }
  return found;
}

/**
 * 删除计划
 * @param {number} planId - 计划 ID
 * @returns {boolean} 是否成功
 */
function deletePlan(planId) {
  var all = storage.getTable('plan');
  var originalLen = all.length;
  var filtered = all.filter(function (p) { return p.id !== planId; });
  if (filtered.length < originalLen) {
    storage.setTable('plan', filtered);
    return true;
  }
  return false;
}

/**
 * 获取单个计划
 * @param {number} planId - 计划 ID
 * @returns {Object|null} 计划数据
 */
function get(planId) {
  var all = storage.getTable('plan');
  for (var i = 0; i < all.length; i++) {
    if (all[i].id === planId) return all[i];
  }
  return null;
}

module.exports = {
  list: list,
  listWeek: listWeek,
  listCustomerIdsInWeek: listCustomerIdsInWeek,
  create: create,
  complete: complete,
  delete: deletePlan,
  get: get
};

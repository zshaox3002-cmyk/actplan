/**
 * log.repo.js — 操作日志 CRUD
 * 基于 storage.js + id.js
 */

var storage = require('../storage');
var id = require('../id');
var dateUtil = require('../date');

/**
 * 记录操作日志
 * @param {Object} data - 日志数据
 * @param {number} data.customer_id - 关联客户 ID
 * @param {string} data.field - 修改字段
 * @param {string} data.old_value - 旧值
 * @param {string} data.new_value - 新值
 * @returns {number} 新日志 ID
 */
function add(data) {
  var all = storage.getTable('operation_log');
  var newId = id.nextId('operation_log');

  all.push({
    id: newId,
    customer_id: data.customer_id,
    field: data.field || '',
    old_value: data.old_value || '',
    new_value: data.new_value || '',
    created_at: dateUtil.nowISO()
  });

  storage.setTable('operation_log', all);
  return newId;
}

/**
 * 查询指定客户的操作日志
 * @param {number} customerId - 客户 ID
 * @returns {Array<Object>} 日志列表（按时间倒序）
 */
function listByCustomer(customerId) {
  var all = storage.getTable('operation_log');
  return all
    .filter(function (log) { return log.customer_id === customerId; })
    .sort(function (a, b) { return (b.created_at || '').localeCompare(a.created_at || ''); });
}

module.exports = {
  add: add,
  listByCustomer: listByCustomer
};

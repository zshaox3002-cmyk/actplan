/**
 * task_dismiss.repo.js — 暂不处理记录 CRUD
 * 记录代理人当天选择"暂不处理"的节奏任务，当天不再展示，次日重新判断
 */

var storage = require('../storage');
var id = require('../id');

/**
 * 记录一条暂不处理
 * @param {number} customerId
 * @param {string} taskType - 'break_risk'|'stuck'|'should_advance'
 * @param {string} today - 'YYYY-MM-DD'
 * @returns {Object} 新记录
 */
function dismiss(customerId, taskType, today) {
  var records = storage.getTable('task_dismiss');
  var now = new Date().toISOString();
  var record = {
    id: id.nextId('task_dismiss'),
    customer_id: customerId,
    task_type: taskType,
    dismiss_date: today,
    created_at: now
  };
  records.push(record);
  storage.setTable('task_dismiss', records);
  return record;
}

/**
 * 返回指定日期已暂不处理的 key Set
 * key 格式：customerId + '|' + taskType
 * @param {string} date - 'YYYY-MM-DD'
 * @returns {Object} { [key]: true }
 */
function getDismissedSetForDate(date) {
  var records = storage.getTable('task_dismiss');
  var set = {};
  for (var i = 0; i < records.length; i++) {
    var r = records[i];
    if (r.dismiss_date === date) {
      set[r.customer_id + '|' + r.task_type] = true;
    }
  }
  return set;
}

/**
 * 清理 7 天前的记录，防止表无限增长
 * 建议在 app.js onLaunch 调用
 * @param {string} today - 'YYYY-MM-DD'
 */
function pruneOld(today) {
  var records = storage.getTable('task_dismiss');
  var cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - 7);
  var cutoffStr = cutoff.toISOString().substring(0, 10);
  var kept = records.filter(function (r) { return r.dismiss_date >= cutoffStr; });
  if (kept.length < records.length) {
    storage.setTable('task_dismiss', kept);
  }
}

module.exports = { dismiss: dismiss, getDismissedSetForDate: getDismissedSetForDate, pruneOld: pruneOld };

/**
 * review-stats.js — 复盘页统计计算
 * 纯函数，输入 snapshot + 周期 → 输出各维度指标
 */

var dateUtil = require('./date');
var constants = require('./constants');

/**
 * 获取指定周期的日期范围
 * @param {string} period - 'thisWeek'|'lastWeek'|'thisMonth'
 * @returns {[string, string]} [startDate, endDate]
 */
function _getPeriodRange(period) {
  var now = new Date();
  if (period === 'lastWeek') {
    var lastWeekAnchor = new Date(now);
    lastWeekAnchor.setDate(now.getDate() - 7);
    return dateUtil.getWeekRange(lastWeekAnchor);
  }
  if (period === 'thisMonth') {
    return dateUtil.getMonthRange();
  }
  return dateUtil.getWeekRange();
}

/**
 * 获取上一个对比周期的日期范围
 * @param {string} period - 'thisWeek'|'lastWeek'|'thisMonth'
 * @returns {[string, string]}
 */
function _getPreviousRange(period) {
  var now = new Date();
  if (period === 'lastWeek') {
    var anchor = new Date(now);
    anchor.setDate(now.getDate() - 14);
    return dateUtil.getWeekRange(anchor);
  }
  if (period === 'thisMonth') {
    var prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15);
    return dateUtil.getMonthRange(prevMonth);
  }
  var lastWeek = new Date(now);
  lastWeek.setDate(now.getDate() - 7);
  return dateUtil.getWeekRange(lastWeek);
}

/**
 * 一次性计算当前和上期的日期范围
 * @param {string} period - 'thisWeek'|'lastWeek'|'thisMonth'
 * @returns {{ current: [string, string], previous: [string, string] }}
 */
function getRanges(period) {
  return {
    current: _getPeriodRange(period),
    previous: _getPreviousRange(period)
  };
}

/**
 * 计算活动摘要指标
 * @param {Object} snapshot
 * @param {{ current: [string, string], previous: [string, string] }} ranges
 * @returns {{ current: Object, previous: Object }}
 */
function getReviewMetrics(snapshot, ranges) {
  var current = _calcMetrics(snapshot, ranges.current[0], ranges.current[1]);
  var previous = _calcMetrics(snapshot, ranges.previous[0], ranges.previous[1]);
  return { current: current, previous: previous };
}

function _calcMetrics(snapshot, start, end) {
  var visitCount = 0;
  var newCustomers = 0;
  var stageAdvances = 0;
  var dealCount = 0;

  for (var i = 0; i < snapshot.visit_record.length; i++) {
    var r = snapshot.visit_record[i];
    if (r.visit_date >= start && r.visit_date <= end) visitCount++;
  }

  for (var j = 0; j < snapshot.customer.length; j++) {
    var c = snapshot.customer[j];
    var createdAt = (c.created_at || '').substring(0, 10);
    if (createdAt >= start && createdAt <= end) newCustomers++;
    if (c.stage === constants.STAGE.DEAL) {
      var stageDate = (c.stage_updated_at || '').substring(0, 10);
      if (stageDate >= start && stageDate <= end) dealCount++;
    }
  }

  // 阶段推进次数：从 operation_log 中统计 stage 字段变更
  var logs = snapshot.operation_log || [];
  for (var k = 0; k < logs.length; k++) {
    var log = logs[k];
    if (log.field === 'stage') {
      var logDate = (log.created_at || '').substring(0, 10);
      if (logDate >= start && logDate <= end) stageAdvances++;
    }
  }

  return {
    visitCount: visitCount,
    newCustomers: newCustomers,
    stageAdvances: stageAdvances,
    dealCount: dealCount
  };
}

/**
 * 按拜访方式分组统计（含推进率）
 * @param {Object} snapshot
 * @param {{ current: [string, string] }} ranges
 * @returns {Array<{ way: string, count: number, advanceRate: number }>}
 */
function getMethodComparison(snapshot, ranges) {
  var start = ranges.current[0];
  var end = ranges.current[1];

  var wayMap = {};
  var wayAdvanceMap = {};

  for (var i = 0; i < snapshot.visit_record.length; i++) {
    var r = snapshot.visit_record[i];
    if (r.visit_date < start || r.visit_date > end) continue;
    var way = r.visit_way || '其他';
    wayMap[way] = (wayMap[way] || 0) + 1;
    if (r.comm_result === 'smooth' || r.is_deal === constants.DEAL_STATUS.DEAL) {
      wayAdvanceMap[way] = (wayAdvanceMap[way] || 0) + 1;
    }
  }

  var result = [];
  var ways = constants.VISIT_WAY_OPTIONS;
  for (var j = 0; j < ways.length; j++) {
    var w = ways[j];
    var count = wayMap[w] || 0;
    if (count === 0) continue;
    var advances = wayAdvanceMap[w] || 0;
    result.push({
      way: w,
      count: count,
      advanceRate: Math.round((advances / count) * 100)
    });
  }

  return result;
}

/**
 * 阶段流转统计
 * @param {Object} snapshot
 * @param {{ current: [string, string] }} ranges
 * @returns {Array<{ from: string, to: string, count: number }>}
 */
function getStageFlow(snapshot, ranges) {
  var start = ranges.current[0];
  var end = ranges.current[1];
  var logs = snapshot.operation_log || [];

  var flowMap = {};
  for (var i = 0; i < logs.length; i++) {
    var log = logs[i];
    if (log.field !== 'stage') continue;
    var logDate = (log.created_at || '').substring(0, 10);
    if (logDate < start || logDate > end) continue;
    var key = log.old_value + '→' + log.new_value;
    flowMap[key] = (flowMap[key] || 0) + 1;
  }

  var result = [];
  for (var key in flowMap) {
    var parts = key.split('→');
    result.push({ key: key, from: parts[0], to: parts[1], count: flowMap[key] });
  }
  result.sort(function (a, b) { return b.count - a.count; });
  return result;
}

/**
 * 异议回顾统计
 * @param {Object} snapshot
 * @param {{ current: [string, string] }} ranges
 * @returns {{ total: number, resolvedTotal: number, categories: Array<{ name: string, count: number, resolved: number, items: Array<{ content: string, customerName: string, date: string, result: string, resultClass: string, solution: string }> }> }}
 */
function getObjectionSummary(snapshot, ranges) {
  var start = ranges.current[0];
  var end = ranges.current[1];
  var notes = snapshot.objection_note || [];

  var catMap = {};
  var total = 0;
  var resolvedTotal = 0;

  for (var i = 0; i < notes.length; i++) {
    var note = notes[i];
    var noteDate = (note.created_at || '').substring(0, 10);
    if (noteDate < start || noteDate > end) continue;

    var customer = _findCustomer(snapshot, note.customer_id);
    if (!customer) continue;

    total++;

    var objection = _findObjection(snapshot, note.objection_id);
    var cat = objection ? (objection.category || '其他') : '其他';

    if (!catMap[cat]) catMap[cat] = { count: 0, resolved: 0, items: [] };
    catMap[cat].count++;

    var result = note.result || '仍在考虑';
    var resultClass = result === '已化解' ? 'resolved' : result === '未化解' ? 'unresolved' : 'pending';
    if (result === '已化解') {
      catMap[cat].resolved++;
      resolvedTotal++;
    }

    catMap[cat].items.push({
      content: objection ? (objection.content || '') : '',
      customerName: customer ? (customer.name || '') : '',
      date: noteDate.slice(5).replace('-', '/'),
      result: result,
      resultClass: resultClass,
      solution: objection ? (objection.solution || '') : ''
    });
  }

  var categories = [];
  for (var catName in catMap) {
    var entry = catMap[catName];
    categories.push({ name: catName, count: entry.count, resolved: entry.resolved, items: entry.items });
  }
  categories.sort(function (a, b) { return b.count - a.count; });

  var resolveRate = total > 0 ? Math.round((resolvedTotal / total) * 100) : 0;
  return { total: total, resolvedTotal: resolvedTotal, resolveRate: resolveRate, categories: categories };
}

function _findCustomer(snapshot, customerId) {
  var customers = snapshot.customer || [];
  for (var i = 0; i < customers.length; i++) {
    if (customers[i].id === customerId) return customers[i];
  }
  return null;
}

function _findObjection(snapshot, objectionId) {
  var objections = snapshot.objection || [];
  for (var i = 0; i < objections.length; i++) {
    if (objections[i].id === objectionId) return objections[i];
  }
  // 预置异议 id 是字符串（如 'preset_price_01'），从 preset 模块查找
  if (typeof objectionId === 'string' && objectionId.indexOf('preset_') === 0) {
    var presetModule = null;
    try { presetModule = require('./objection-preset'); } catch (e) {}
    var presets = (presetModule && presetModule.PRESET_OBJECTIONS) || [];
    for (var j = 0; j < presets.length; j++) {
      if (presets[j].id === objectionId) return presets[j];
    }
  }
  return null;
}

module.exports = {
  getRanges: getRanges,
  getReviewMetrics: getReviewMetrics,
  getMethodComparison: getMethodComparison,
  getStageFlow: getStageFlow,
  getObjectionSummary: getObjectionSummary
};

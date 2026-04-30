/**
 * rhythm.js — 客户节奏分类引擎
 * 纯函数，将客户分为三类：升温中 / 降温中 / 卡住了
 * 输入：客户列表 + 拜访记录列表 + 今天日期
 * 输出：{ warming: [], cooling: [], stuck: [] }
 */

var constants = require('./constants');
var dateUtil = require('./date');

var STUCK_THRESHOLDS = {
  '初步认识': 21,
  '需求沟通': 21,
  '方案讲解': 14,
  '待促成': 7
};

var RECENT_WINDOW = 14;
var BASELINE_WINDOW = 30;
var WARMING_RATIO = 1.5;
var COOLING_RATIO = 0.5;
var COLD_DAYS = 14;

/**
 * 按 customer_id 建立拜访记录索引
 * @param {Array} records
 * @returns {Object} { customerId: [record, ...] }
 */
function _indexByCustomer(records) {
  var index = {};
  for (var i = 0; i < records.length; i++) {
    var cid = records[i].customer_id;
    if (!index[cid]) index[cid] = [];
    index[cid].push(records[i]);
  }
  return index;
}

/**
 * 计算指定客户在日期范围内的拜访次数
 * @param {Array} customerRecords - 该客户的拜访记录
 * @param {string} startDate - 'YYYY-MM-DD'（含）
 * @param {string} endDate - 'YYYY-MM-DD'（含）
 * @returns {number}
 */
function _countInRange(customerRecords, startDate, endDate) {
  var count = 0;
  for (var i = 0; i < customerRecords.length; i++) {
    var d = customerRecords[i].visit_date;
    if (d >= startDate && d <= endDate) count++;
  }
  return count;
}

/**
 * 计算客户在当前阶段的停留天数
 * @param {Object} customer
 * @param {string} today - 'YYYY-MM-DD'
 * @returns {number}
 */
function getStageDuration(customer, today) {
  var stageDate = (customer.stage_updated_at || customer.created_at || '').substring(0, 10);
  if (!stageDate) return 0;
  return dateUtil.daysBetween(today, stageDate);
}

/**
 * 生成节奏信号描述文案
 * @param {Object} item - 分类结果项 { customer, type, ... }
 * @returns {string}
 */
function formatRhythmSignal(item) {
  if (item.type === 'warming') {
    return '最近' + RECENT_WINDOW + '天拜访' + item.recentCount + '次(↑' + Math.round((item.ratio - 1) * 100) + '%)';
  }
  if (item.type === 'cooling') {
    return '已' + item.coldDays + '天未联系';
  }
  if (item.type === 'stuck') {
    return '卡在' + item.customer.stage + ' ' + item.overdueDays + '天';
  }
  return '';
}

/**
 * 获取客户最后一次拜访方式
 * @param {Array} customerRecords - 该客户的拜访记录
 * @returns {string}
 */
function getLastVisitWay(customerRecords) {
  if (!customerRecords || customerRecords.length === 0) return '';
  var latest = customerRecords[0];
  for (var i = 1; i < customerRecords.length; i++) {
    if (customerRecords[i].visit_date > latest.visit_date) {
      latest = customerRecords[i];
    }
  }
  return latest.visit_way || '';
}

/**
 * 将客户分为升温/降温/卡住三类
 * @param {Array} customers - 全量客户列表
 * @param {Array} records - 全量拜访记录
 * @param {string} today - 'YYYY-MM-DD'
 * @returns {{ warming: Array, cooling: Array, stuck: Array }}
 */
function classifyCustomers(customers, records, today) {
  var warming = [];
  var cooling = [];
  var stuck = [];

  var recordIndex = _indexByCustomer(records);
  var recentStart = dateUtil.formatDate(new Date(new Date(today).getTime() - RECENT_WINDOW * 86400000), 'YYYY-MM-DD');
  var baselineStart = dateUtil.formatDate(new Date(new Date(today).getTime() - (RECENT_WINDOW + BASELINE_WINDOW) * 86400000), 'YYYY-MM-DD');
  var baselineEnd = dateUtil.formatDate(new Date(new Date(today).getTime() - (RECENT_WINDOW + 1) * 86400000), 'YYYY-MM-DD');

  for (var i = 0; i < customers.length; i++) {
    var c = customers[i];
    if (c.stage === constants.STAGE.DEAL || c.stage === constants.STAGE.LOST) continue;

    var cRecords = recordIndex[c.id] || [];
    var recentCount = _countInRange(cRecords, recentStart, today);
    var baselineCount = _countInRange(cRecords, baselineStart, baselineEnd);
    // 归一化：将基线窗口的计数缩放到与近期窗口相同的时间跨度
    var baselineNorm = baselineCount / (BASELINE_WINDOW / RECENT_WINDOW);

    if (recentCount >= 2 && (baselineNorm === 0 || recentCount / baselineNorm >= WARMING_RATIO)) {
      warming.push({
        customer: c,
        type: 'warming',
        recentCount: recentCount,
        ratio: baselineNorm === 0 ? recentCount : recentCount / baselineNorm,
        lastVisitWay: getLastVisitWay(cRecords)
      });
      continue;
    }

    var lastVisit = c.last_visit || '';
    var coldDays = lastVisit ? dateUtil.daysBetween(today, lastVisit) : 999;
    if (coldDays >= COLD_DAYS || (baselineNorm > 0 && recentCount / baselineNorm <= COOLING_RATIO)) {
      cooling.push({
        customer: c,
        type: 'cooling',
        coldDays: coldDays,
        recentCount: recentCount,
        lastVisitWay: getLastVisitWay(cRecords)
      });
      continue;
    }

    var threshold = STUCK_THRESHOLDS[c.stage];
    if (threshold) {
      var duration = getStageDuration(c, today);
      if (duration >= threshold) {
        stuck.push({
          customer: c,
          type: 'stuck',
          overdueDays: duration,
          threshold: threshold,
          lastVisitWay: getLastVisitWay(cRecords)
        });
      }
    }
  }

  warming.sort(function (a, b) { return b.ratio - a.ratio; });
  cooling.sort(function (a, b) { return b.coldDays - a.coldDays; });
  stuck.sort(function (a, b) { return b.overdueDays - a.overdueDays; });

  return { warming: warming, cooling: cooling, stuck: stuck };
}

module.exports = {
  classifyCustomers: classifyCustomers,
  getStageDuration: getStageDuration,
  formatRhythmSignal: formatRhythmSignal
};

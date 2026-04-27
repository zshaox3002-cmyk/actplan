/**
 * stats.js — Dashboard 统计计算
 * 所有函数为纯函数，输入 snapshot → 输出结果
 * snapshot 由 getStatsSnapshot() 一次性加载
 * 支持多周期维度：本周 / 本月 / 季度 / 年度
 */

var dateUtil = require('./date');
var constants = require('./constants');

/**
 * 一次性加载所有表到内存
 * @returns {Object} { customer, visit_record, plan, objection, objection_note }
 */
function getStatsSnapshot() {
  var storage = require('./storage');
  return {
    customer: storage.getTable('customer'),
    visit_record: storage.getTable('visit_record'),
    plan: storage.getTable('plan'),
    objection: storage.getTable('objection'),
    objection_note: storage.getTable('objection_note'),
    objection_links: storage.getTable('objection_links') || []
  };
}

/**
 * 根据周期类型获取日期范围 [startISO, endISO]
 * @param {string} period - 周期类型：'week'|'month'|'quarter'|'year'
 * @returns {[string, string]}
 */
function getRangeByPeriod(period) {
  switch (period) {
    case 'month': return dateUtil.getMonthRange();
    case 'quarter': return dateUtil.getQuarterRange();
    case 'year': return dateUtil.getYearRange();
    default: return dateUtil.getWeekRange();
  }
}

/**
 * 获取 Dashboard 4 个指标
 * @param {Object} snapshot - getStatsSnapshot() 返回值
 * @param {string} [period='week'] - 周期类型：'week'|'month'|'quarter'|'year'
 * @returns {Object} { totalCustomers, newCustomers, visitCount, appointmentCount }
 */
function getDashboardMetrics(snapshot, period) {
  var range = getRangeByPeriod(period || 'week');
  var startISO = range[0];
  var endISO = range[1];

  // 总客户数
  var totalCustomers = snapshot.customer.length;

  // 本期新增客户：created_at 在本周范围内
  var newCustomers = 0;
  for (var i = 0; i < snapshot.customer.length; i++) {
    var c = snapshot.customer[i];
    var createdAt = (c.created_at || '').substring(0, 10);
    if (createdAt >= startISO && createdAt <= endISO) {
      newCustomers++;
    }
  }

  // 本期拜访：本周内 visit_date 在范围内的记录数
  var visitCount = 0;
  for (var j = 0; j < snapshot.visit_record.length; j++) {
    var r = snapshot.visit_record[j];
    var visitDate = r.visit_date || '';
    if (visitDate >= startISO && visitDate <= endISO) {
      visitCount++;
    }
  }

  // 本期预约：本周内 created_at 在范围内的计划数
  // （创建日期在本周内，代表本周新建了多少拜访计划）
  var appointmentCount = 0;
  for (var k = 0; k < snapshot.plan.length; k++) {
    var p = snapshot.plan[k];
    var planCreatedAt = (p.created_at || '').substring(0, 10);
    if (planCreatedAt >= startISO && planCreatedAt <= endISO) {
      appointmentCount++;
    }
  }

  return {
    totalCustomers: totalCustomers,
    newCustomers: newCustomers,
    visitCount: visitCount,
    appointmentCount: appointmentCount
  };
}

/**
 * 苹果分布
 * @param {Object} snapshot
 * @returns {Array<{name: string, value: number}>}
 */
function getAppleDistribution(snapshot) {
  var map = {};
  // 确保所有等级都出现
  var ranks = ['红苹果', '青苹果', '烂苹果', '待定'];
  for (var r = 0; r < ranks.length; r++) {
    map[ranks[r]] = 0;
  }

  for (var i = 0; i < snapshot.customer.length; i++) {
    var rank = snapshot.customer[i].apple_grade || snapshot.customer[i].apple_rank || 'pending';
    // apple_grade 存储 value（red/green/rotten/pending），需转换为中文标签
    var GRADE_LABEL = { 'red': '红苹果', 'green': '青苹果', 'rotten': '烂苹果', 'pending': '待定' };
    var rankLabel = GRADE_LABEL[rank] || rank;
    if (map[rankLabel] === undefined) map[rankLabel] = 0;
    map[rankLabel]++;
  }

  var result = [];
  for (var name in map) {
    if (map[name] > 0) {
      result.push({ name: name, value: map[name] });
    }
  }

  return result;
}

/**
 * 异议分布（按分类累加出现次数，合并预置 + 自建）
 * @param {Object} snapshot
 * @returns {Array<{name: string, value: number}>}
 */
function getObjectionDistribution(snapshot) {
  var map = {};

  // 1. 预置异议：从 objection_links 统计各 presetId 出现次数，再按分类累加
  var links = snapshot.objection_links || [];
  var linkCountMap = {};
  for (var l = 0; l < links.length; l++) {
    var pid = links[l].presetId;
    if (pid) linkCountMap[pid] = (linkCountMap[pid] || 0) + 1;
  }

  // 加载预置异议数据以获取分类
  var presetModule;
  try { presetModule = require('./objection-preset'); } catch (e) { presetModule = null; }
  var PRESETS = (presetModule && presetModule.PRESET_OBJECTIONS) || [];

  for (var p = 0; p < PRESETS.length; p++) {
    var preset = PRESETS[p];
    var presetCount = linkCountMap[preset.id] || 0;
    if (presetCount > 0) {
      var pcat = preset.category || '其他';
      if (!map[pcat]) map[pcat] = 0;
      map[pcat] += presetCount;
    }
  }

  // 2. 用户自建异议：直接从 objection 表按 count 累加
  for (var i = 0; i < snapshot.objection.length; i++) {
    var cat = snapshot.objection[i].category || '其他';
    var count = snapshot.objection[i].count || 0;
    if (!map[cat]) map[cat] = 0;
    map[cat] += count;
  }

  var result = [];
  // 按预设顺序输出
  var order = constants.OBJECTION_CATEGORY_OPTIONS;
  for (var j = 0; j < order.length; j++) {
    if (map[order[j]]) {
      result.push({ name: order[j], value: map[order[j]] });
    }
  }

  return result;
}

/**
 * 拜访趋势（7 天）
 * @param {Object} snapshot
 * @param {Date|string} [anchorDate] - 锚点日期，默认今天
 * @returns {Array<{date: string, label: string, planCount: number, visitCount: number}>}
 */
function getVisitTrend(snapshot, anchorDate) {
  var weekDays = dateUtil.getWeekDays(anchorDate);
  var labels = ['一', '二', '三', '四', '五', '六', '日'];

  var result = [];
  for (var i = 0; i < weekDays.length; i++) {
    var dateStr = weekDays[i].date;

    // 计划数
    var planCount = 0;
    for (var p = 0; p < snapshot.plan.length; p++) {
      if (snapshot.plan[p].plan_date === dateStr) {
        planCount++;
      }
    }

    // 拜访数
    var visitCount = 0;
    for (var v = 0; v < snapshot.visit_record.length; v++) {
      if (snapshot.visit_record[v].visit_date === dateStr) {
        visitCount++;
      }
    }

    result.push({
      date: dateStr,
      label: labels[i],
      planCount: planCount,
      visitCount: visitCount
    });
  }

  return result;
}

module.exports = {
  getStatsSnapshot: getStatsSnapshot,
  getDashboardMetrics: getDashboardMetrics,
  getAppleDistribution: getAppleDistribution,
  getObjectionDistribution: getObjectionDistribution,
  getVisitTrend: getVisitTrend
};

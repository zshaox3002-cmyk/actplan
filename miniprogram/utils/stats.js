/**
 * stats.js — Dashboard 统计计算
 * 所有函数为纯函数，输入 snapshot → 输出结果
 * snapshot 由 getStatsSnapshot() 一次性加载
 * 支持多周期维度：本周 / 本月 / 季度 / 年度
 */

var dateUtil = require('./date');
var constants = require('./constants');
var priority = require('./priority');

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
 * 获取 Dashboard 4 个指标（全部为本期增量）
 * @param {Object} snapshot - getStatsSnapshot() 返回值
 * @param {string} [period='week'] - 周期类型：'week'|'month'|'quarter'|'year'
 * @returns {Object} { newCustomers, visitCount, appointmentCount, dealCustomers }
 */
function getDashboardMetrics(snapshot, period) {
  var range = getRangeByPeriod(period || 'week');
  var startISO = range[0];
  var endISO = range[1];

  // 本期新增客户：created_at 在本期范围内
  var newCustomers = 0;
  // 本期成交客户：stage='已成交' 且 stage_updated_at 在本期范围内
  var dealCustomers = 0;
  for (var i = 0; i < snapshot.customer.length; i++) {
    var c = snapshot.customer[i];
    var createdAt = (c.created_at || '').substring(0, 10);
    if (createdAt >= startISO && createdAt <= endISO) {
      newCustomers++;
    }
    if (c.stage === '已成交') {
      var stageUpdated = (c.stage_updated_at || '').substring(0, 10);
      if (stageUpdated >= startISO && stageUpdated <= endISO) {
        dealCustomers++;
      }
    }
  }

  // 本期拜访：visit_date 在范围内的记录数
  var visitCount = 0;
  for (var j = 0; j < snapshot.visit_record.length; j++) {
    var r = snapshot.visit_record[j];
    var visitDate = r.visit_date || '';
    if (visitDate >= startISO && visitDate <= endISO) {
      visitCount++;
    }
  }

  // 本期预约：plan_date 在范围内的计划数
  var appointmentCount = 0;
  for (var k = 0; k < snapshot.plan.length; k++) {
    var p = snapshot.plan[k];
    var planDate = p.plan_date || '';
    if (planDate >= startISO && planDate <= endISO) {
      appointmentCount++;
    }
  }

  return {
    newCustomers: newCustomers,
    visitCount: visitCount,
    appointmentCount: appointmentCount,
    dealCustomers: dealCustomers
  };
}

/**
 * 客户阶段漏斗数据
 * @param {Object} snapshot
 * @returns {Array<{stage: string, count: number}>} 按阶段顺序排列
 */
function getStageFunnel(snapshot) {
  var order = ['初步认识', '需求沟通', '方案讲解', '待促成', '已成交', '已流失'];
  var BAR_COLORS = {
    '初步认识': 'var(--stage-meet-text)',
    '需求沟通': 'var(--stage-comm-text)',
    '方案讲解': 'var(--stage-present-text)',
    '待促成':   'var(--stage-closing-text)',
    '已成交':   'var(--stage-deal-text)',
    '已流失':   'var(--stage-lost-text)'
  };
  var map = {};
  for (var i = 0; i < order.length; i++) map[order[i]] = 0;

  for (var j = 0; j < snapshot.customer.length; j++) {
    var stage = snapshot.customer[j].stage || '';
    if (map[stage] !== undefined) map[stage]++;
  }

  return order.map(function (s) {
    return { stage: s, count: map[s], barColor: BAR_COLORS[s] || 'var(--color-primary)' };
  });
}

/**
 * 待跟进客户列表（按优先级排序）
 * 已成交 / 已流失客户不参与评分，不出现在列表中
 * @param {Object} snapshot
 * @param {number} [limit] - 最多返回条数，不传则返回全部
 * @returns {Array<{customer: Object, priority: Object, nextPlan: Object|null}>}
 */
function getPendingFollowUp(snapshot, limit) {
  var result = [];

  for (var i = 0; i < snapshot.customer.length; i++) {
    var c = snapshot.customer[i];

    // 找该客户最近一条待执行计划
    var nextPlan = null;
    var today = new Date();
    var todayStr = today.getFullYear() + '-' +
      String(today.getMonth() + 1).padStart(2, '0') + '-' +
      String(today.getDate()).padStart(2, '0');

    for (var j = 0; j < snapshot.plan.length; j++) {
      var p = snapshot.plan[j];
      if (p.customer_id === c.id && p.status === '待执行') {
        if (!nextPlan || p.plan_date < nextPlan.plan_date) {
          nextPlan = p;
        }
      }
    }

    var pri = priority.calculatePriority(c, nextPlan);
    if (!pri) continue; // 已成交/已流失跳过

    result.push({ customer: c, priority: pri, nextPlan: nextPlan });
  }

  // 按 score 降序排列
  result.sort(function (a, b) { return b.priority.score - a.priority.score; });

  return limit ? result.slice(0, limit) : result;
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
  getStageFunnel: getStageFunnel,
  getPendingFollowUp: getPendingFollowUp,
  getObjectionDistribution: getObjectionDistribution,
  getVisitTrend: getVisitTrend
};

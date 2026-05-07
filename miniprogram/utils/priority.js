/**
 * priority.js — 客户跟进优先级计算引擎（P0-P3）
 *
 * 公式：score = 意向度 I + 紧迫度 U + 活跃度 R
 * 已成交 / 已流失客户返回 null，不参与评分
 */

var dateUtil = require('./date');

/** 意向度：基于客户阶段 */
var _INTENT_SCORE = {
  '待促成': 40,
  '方案讲解': 30,
  '需求沟通': 20,
  '初步认识': 10
};

/**
 * 计算紧迫度：基于下次跟进计划日期与今天的距离
 * @param {string|null} planDate - 'YYYY-MM-DD' 或 null
 * @param {string} today - 'YYYY-MM-DD'
 * @returns {number}
 */
function _urgencyScore(planDate, today) {
  if (!planDate) return 0;
  var diff = Math.round((new Date(planDate) - new Date(today)) / 86400000);
  if (diff < -2) return 35;   // 逾期 3 天以上
  if (diff < 0) return 30;    // 逾期 1-2 天
  if (diff === 0) return 25;  // 今天
  if (diff === 1) return 18;  // 明天
  if (diff <= 3) return 12;   // 3 天内
  if (diff <= 7) return 6;    // 7 天内
  return 0;
}

/**
 * 计算活跃度：基于最近拜访日期与今天的距离
 * 从未拜访时按创建时间冷启动加分，确保新客户前 14 天不被埋没
 * @param {string|null} lastVisit - 'YYYY-MM-DD' 或 null
 * @param {string} today - 'YYYY-MM-DD'
 * @param {string|null} createdAt - ISO 8601 创建时间，冷启动时使用
 * @returns {number}
 */
function _recencyScore(lastVisit, today, createdAt) {
  if (!lastVisit) {
    // 冷启动：从未拜访，按创建时间加分
    if (!createdAt) return 0;
    var daysSinceCreated = Math.round((new Date(today) - new Date(createdAt.substring(0, 10))) / 86400000);
    if (daysSinceCreated <= 7) return 20;
    if (daysSinceCreated <= 14) return 10;
    return 0;
  }
  var diff = Math.round((new Date(today) - new Date(lastVisit)) / 86400000);
  if (diff <= 3) return 25;
  if (diff <= 7) return 18;
  if (diff <= 14) return 10;
  if (diff <= 30) return 5;
  return 0;
}

/**
 * 计算客户跟进优先级
 * @param {Object} customer - 客户对象，需含 stage / last_visit
 * @param {Object|null} nextPlan - 下一条待执行计划，需含 plan_date；无计划传 null
 * @returns {{ score: number, level: string, label: string }|null} 已成交/已流失返回 null
 */
function calculatePriority(customer, nextPlan) {
  var stage = customer.stage || '';
  if (stage === '已成交' || stage === '已流失') return null;

  var today = dateUtil.getWeekRange()[0].substring(0, 10);
  // 用当前日期而非周起始，getWeekRange 返回 [start, end]，取今天
  var now = new Date();
  today = now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0');

  var I = _INTENT_SCORE[stage] || 0;
  var U = _urgencyScore(nextPlan ? nextPlan.plan_date : null, today);
  var R = _recencyScore(customer.last_visit || null, today, customer.created_at || null);
  var score = I + U + R;

  var level, label;
  if (score >= 80) { level = 'P0'; label = '今日必跟'; }
  else if (score >= 60) { level = 'P1'; label = '本周重点'; }
  else if (score >= 35) { level = 'P2'; label = '保持节奏'; }
  else { level = 'P3'; label = '暂缓跟进'; }

  // 驱动因素：取得分最高的 1-2 个维度，用业务语言描述
  var reasons = [];
  if (nextPlan) {
    var diff = Math.round((new Date(nextPlan.plan_date) - new Date(today)) / 86400000);
    if (diff === 0) reasons.push('今天有跟进计划');
    else if (diff === 1) reasons.push('明天有跟进计划');
    else if (diff <= 3) reasons.push('3天内有计划');
    else if (diff <= 7) reasons.push('7天内有计划');
  }
  return { score: score, level: level, label: label, reasons: reasons };
}

module.exports = {
  calculatePriority: calculatePriority
};

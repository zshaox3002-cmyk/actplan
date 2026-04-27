/**
 * apple-rank.js — 苹果分级算法
 *
 * DISABLED: apple-auto-grade - 改为用户手动打标，不再自动计算
 * 原函数 calculateAppleRank / canAutoRank 已禁用
 * 如需恢复，取消下方注释即可
 */

// 临时空导出，防止 require 报错
module.exports = {};

/* ---- 以下为原始代码，已禁用 ----
 *
 * function calculateAppleRank(dimensions) {
 *   var has_need = dimensions.has_need;
 *   var has_budget = dimensions.has_budget;
 *   var is_decider = dimensions.is_decider;
 *   if (has_need === '不确定' || has_budget === '不确定' || is_decider === '不确定') {
 *     return '待定';
 *   }
 *   var yesCount = 0;
 *   if (has_need === '是') yesCount++;
 *   if (has_budget === '是') yesCount++;
 *   if (is_decider === '是') yesCount++;
 *   if (yesCount === 3) return '红苹果';
 *   if (yesCount === 2) return '青苹果';
 *   return '烂苹果';
 * }
 *
 * function canAutoRank(customer) {
 *   return customer.has_need !== '不确定'
 *     && customer.has_budget !== '不确定'
 *     && customer.is_decider !== '不确定';
 * }
 *
 * module.exports = {
 *   calculateAppleRank: calculateAppleRank,
 *   canAutoRank: canAutoRank
 * };
 */

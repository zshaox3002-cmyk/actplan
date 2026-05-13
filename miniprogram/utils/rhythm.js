/**
 * rhythm.js — 客户节奏分类引擎 v1.2
 * 纯函数，将客户分为三类：该推进了 / 断档风险 / 卡点待处理
 * 输入：customers, records, plans, objectionNotes, today
 * 输出：{ shouldAdvance: [], breakRisk: [], stuck: [] }
 */

var constants = require('./constants');
var dateUtil = require('./date');

var RHYTHM_RULE_CONFIG = {
  stageFollowDays: {
    '需求沟通': 14,
    '方案讲解': 7,
    '待促成': 5,
    'default': 14
  },
  stageStallDays: {
    '初步认识': 30,
    '需求沟通': 21,
    '方案讲解': 14,
    '待促成': 7
  },
  positiveSmoothDays: 7,
  positiveStageAdvanceDays: 14,
  lowDataCustomerCount: 3,
  lowDataRecordCount: 3
};

var STAGE_RANK = {
  '初步认识': 0,
  '需求沟通': 1,
  '方案讲解': 2,
  '待促成': 3,
  '已成交': 4,
  '已流失': -1
};

var INTIMACY_RANK = {
  '陌生': 0,
  '普通朋友': 1,
  '熟人': 2,
  '好友': 3,
  '亲密': 4
};

/**
 * @param {string} isoStr
 * @returns {string} 'YYYY-MM-DD'
 */
function _truncateDate(isoStr) {
  if (!isoStr) return '';
  return isoStr.substring(0, 10);
}

/**
 * 按 customer_id 建立索引
 * @param {Array} items
 * @param {string} key - 字段名，默认 'customer_id'
 * @returns {Object}
 */
function _buildIndex(items, key) {
  var k = key || 'customer_id';
  var index = {};
  for (var i = 0; i < items.length; i++) {
    var cid = items[i][k];
    if (!index[cid]) index[cid] = [];
    index[cid].push(items[i]);
  }
  return index;
}

/**
 * 计算客户最近有效动作日期
 * @param {Object} customer
 * @param {Array} customerRecords
 * @returns {string} 'YYYY-MM-DD' 或 ''
 */
function _calcLastActionDate(customer, customerRecords) {
  var dates = [];
  if (customer.last_visit) dates.push(customer.last_visit);
  if (customer.stage_updated_at) dates.push(_truncateDate(customer.stage_updated_at));
  if (customer.created_at) dates.push(_truncateDate(customer.created_at));
  if (dates.length === 0) return '';
  return dates.reduce(function (a, b) { return a > b ? a : b; });
}

/**
 * 是否存在未来待执行计划
 * @param {Array} planList
 * @param {string} today
 * @returns {boolean}
 */
function _hasFuturePlan(planList, today) {
  for (var i = 0; i < planList.length; i++) {
    var p = planList[i];
    if (p.status === '待执行' && p.plan_date >= today) return true;
  }
  return false;
}

/**
 * 获取最近一次沟通结果
 * @param {Array} recordList - 已按 visit_date 降序排列
 * @returns {string}
 */
function _getLastCommResult(recordList) {
  if (!recordList || recordList.length === 0) return '';
  var latest = recordList[0];
  for (var i = 1; i < recordList.length; i++) {
    if (recordList[i].visit_date > latest.visit_date) latest = recordList[i];
  }
  return latest.comm_result || '';
}

/**
 * 是否存在未化解异议
 * @param {Array} noteList - 该客户的 objection_note 列表
 * @returns {boolean}
 */
function _hasUnresolvedObjection(noteList) {
  if (!noteList || noteList.length === 0) return false;
  // 按 created_at 降序取最新一条
  var latest = noteList[0];
  for (var i = 1; i < noteList.length; i++) {
    if ((noteList[i].created_at || '') > (latest.created_at || '')) latest = noteList[i];
  }
  return latest.result !== '已化解';
}

/**
 * 最近 N 天内是否有顺利沟通
 * @param {Array} recordList
 * @param {string} today
 * @param {number} days
 * @returns {boolean}
 */
function _hasRecentSmooth(recordList, today, days) {
  for (var i = 0; i < recordList.length; i++) {
    var r = recordList[i];
    if (r.comm_result === '顺利' && dateUtil.daysBetween(today, r.visit_date) <= days) return true;
  }
  return false;
}

/**
 * 最近 N 天内是否有阶段正向推进
 * @param {Array} recordList
 * @param {string} today
 * @param {number} days
 * @returns {boolean}
 */
function _hasStageAdvance(recordList, today, days) {
  var recent = [];
  for (var i = 0; i < recordList.length; i++) {
    if (dateUtil.daysBetween(today, recordList[i].visit_date) <= days) {
      recent.push(recordList[i]);
    }
  }
  if (recent.length < 2) return false;
  recent.sort(function (a, b) { return a.visit_date < b.visit_date ? -1 : 1; });
  for (var j = 1; j < recent.length; j++) {
    var prev = STAGE_RANK[recent[j - 1].stage] || 0;
    var curr = STAGE_RANK[recent[j].stage] || 0;
    if (curr > prev) return true;
  }
  return false;
}

/**
 * 客户价值排序分值（越高越优先）
 * @param {Object} customer
 * @param {Object} premiumIndex - customer_id → total_premium
 * @returns {number}
 */
function _customerValueScore(customer, premiumIndex) {
  var score = 0;
  if (customer.is_hnw) score += 1000000;
  score += (premiumIndex[customer.id] || 0);
  score += (INTIMACY_RANK[customer.intimacy] || 0) * 100;
  return score;
}

/**
 * 判断卡点待处理
 * @param {Object} customer
 * @param {Object} derived - { stageDays, lastCommResult, hasUnresolvedObjection }
 * @returns {Object|null} 命中时返回卡点信息，否则 null
 */
function _matchStuck(customer, derived) {
  var stage = customer.stage;
  var stuckStages = ['初步认识', '需求沟通', '方案讲解', '待促成'];
  if (stuckStages.indexOf(stage) === -1) return null;

  var reasons = [];

  // 1. 阶段停留过久
  var stallThreshold = RHYTHM_RULE_CONFIG.stageStallDays[stage];
  if (stallThreshold && derived.stageDays >= stallThreshold) {
    reasons.push({
      type: 'stall',
      text: '阶段停留过久',
      evidence: stage + '阶段停留 ' + derived.stageDays + ' 天，阈值为 ' + stallThreshold + ' 天'
    });
  }

  // 2. 最近沟通受阻
  if (derived.lastCommResult === '受阻') {
    reasons.push({
      type: 'blocked',
      text: '最近沟通受阻',
      evidence: '最近一次沟通结果为"受阻"'
    });
  }

  // 3. 存在未化解异议
  if (derived.hasUnresolvedObjection) {
    reasons.push({
      type: 'objection',
      text: '存在未化解异议',
      evidence: '存在尚未化解的异议记录'
    });
  }

  // 4. 关键信息明确缺失（仅 '否' 命中，'不确定' 不命中）
  var advancedStages = ['需求沟通', '方案讲解', '待促成'];
  var presentStages = ['方案讲解', '待促成'];
  if (advancedStages.indexOf(stage) !== -1 && customer.has_need === '否') {
    reasons.push({
      type: 'missing_need',
      text: '关键信息明确缺失（需求）',
      evidence: '客户需求字段明确为"否"'
    });
  }
  if (presentStages.indexOf(stage) !== -1 && customer.has_ability === '否') {
    reasons.push({
      type: 'missing_ability',
      text: '关键信息明确缺失（能力）',
      evidence: '客户购买能力字段明确为"否"'
    });
  }
  if (presentStages.indexOf(stage) !== -1 && customer.is_decider === '否') {
    reasons.push({
      type: 'missing_decider',
      text: '关键信息明确缺失（决策人）',
      evidence: '客户决策人字段明确为"否"'
    });
  }

  if (reasons.length === 0) return null;

  return {
    reasons: reasons,
    primaryReason: reasons[0],
    hasUnresolvedObjection: derived.hasUnresolvedObjection,
    lastCommBlocked: derived.lastCommResult === '受阻'
  };
}

/**
 * 判断断档风险
 * @param {Object} customer
 * @param {Object} derived - { daysSinceLastAction, hasFuturePlan }
 * @returns {Object|null}
 */
function _matchBreakRisk(customer, derived) {
  var stage = customer.stage;
  var breakStages = ['需求沟通', '方案讲解', '待促成'];
  if (breakStages.indexOf(stage) === -1) return null;
  if (derived.hasFuturePlan) return null;

  var followThreshold = RHYTHM_RULE_CONFIG.stageFollowDays[stage] || RHYTHM_RULE_CONFIG.stageFollowDays['default'];
  if (derived.daysSinceLastAction < followThreshold) return null;

  var overdueDays = derived.daysSinceLastAction - followThreshold;
  return {
    followThreshold: followThreshold,
    daysSinceLastAction: derived.daysSinceLastAction,
    overdueDays: overdueDays
  };
}

/**
 * 判断该推进了
 * @param {Object} customer
 * @param {Object} derived - { hasRecentSmooth, hasStageAdvance }
 * @returns {Object|null}
 */
function _matchShouldAdvance(customer, derived) {
  var stage = customer.stage;
  var advanceStages = ['需求沟通', '方案讲解', '待促成'];
  if (advanceStages.indexOf(stage) === -1) return null;

  if (derived.hasRecentSmooth) {
    return { trigger: 'smooth', text: '最近沟通顺利' };
  }
  if (derived.hasStageAdvance) {
    return { trigger: 'advance', text: '阶段刚推进' };
  }
  return null;
}

/**
 * 将客户分为三类：该推进了 / 断档风险 / 卡点待处理
 * @param {Array} customers
 * @param {Array} records
 * @param {Array} plans
 * @param {Array} objectionNotes
 * @param {string} today - 'YYYY-MM-DD'
 * @param {Array} [policies] - 保单列表，用于客户价值排序
 * @returns {{ shouldAdvance: Array, breakRisk: Array, stuck: Array }}
 */
function classifyCustomers(customers, records, plans, objectionNotes, today, policies) {
  var shouldAdvance = [];
  var breakRisk = [];
  var stuck = [];

  var recordIndex = _buildIndex(records);
  var planIndex = _buildIndex(plans);
  var noteIndex = _buildIndex(objectionNotes);

  // 聚合 total_premium 用于排序
  var premiumIndex = {};
  var policyList = policies || [];
  for (var pi = 0; pi < policyList.length; pi++) {
    var pol = policyList[pi];
    var cid = pol.customer_id;
    premiumIndex[cid] = (premiumIndex[cid] || 0) + (pol.premium || 0);
  }

  for (var i = 0; i < customers.length; i++) {
    var c = customers[i];
    if (c.stage === constants.STAGE.DEAL || c.stage === constants.STAGE.LOST) continue;

    var cRecords = recordIndex[c.id] || [];
    var cPlans = planIndex[c.id] || [];
    var cNotes = noteIndex[c.id] || [];

    var lastActionDate = _calcLastActionDate(c, cRecords);
    if (!lastActionDate) continue;

    var stageDateStr = _truncateDate(c.stage_updated_at) || _truncateDate(c.created_at);
    var stageDays = stageDateStr ? dateUtil.daysBetween(today, stageDateStr) : 0;
    var daysSinceLastAction = dateUtil.daysBetween(today, lastActionDate);

    var derived = {
      stageDays: stageDays,
      daysSinceLastAction: daysSinceLastAction,
      lastCommResult: _getLastCommResult(cRecords),
      hasUnresolvedObjection: _hasUnresolvedObjection(cNotes),
      hasFuturePlan: _hasFuturePlan(cPlans, today),
      hasRecentSmooth: _hasRecentSmooth(cRecords, today, RHYTHM_RULE_CONFIG.positiveSmoothDays),
      hasStageAdvance: _hasStageAdvance(cRecords, today, RHYTHM_RULE_CONFIG.positiveStageAdvanceDays)
    };

    var valueScore = _customerValueScore(c, premiumIndex);

    var stuckResult = _matchStuck(c, derived);
    if (stuckResult) {
      stuck.push({
        customer: c,
        type: 'stuck',
        stuckInfo: stuckResult,
        stageDays: stageDays,
        valueScore: valueScore,
        hasUnresolvedObjection: stuckResult.hasUnresolvedObjection,
        lastCommBlocked: stuckResult.lastCommBlocked
      });
      continue;
    }

    var breakResult = _matchBreakRisk(c, derived);
    if (breakResult) {
      breakRisk.push({
        customer: c,
        type: 'breakRisk',
        breakInfo: breakResult,
        valueScore: valueScore
      });
      continue;
    }

    var advanceResult = _matchShouldAdvance(c, derived);
    if (advanceResult) {
      shouldAdvance.push({
        customer: c,
        type: 'shouldAdvance',
        advanceInfo: advanceResult,
        lastCommResult: derived.lastCommResult,
        lastActionDate: lastActionDate,
        valueScore: valueScore
      });
    }
  }

  // 排序：卡点待处理
  stuck.sort(function (a, b) {
    // 1. 最近沟通受阻优先
    if (a.lastCommBlocked !== b.lastCommBlocked) return a.lastCommBlocked ? -1 : 1;
    // 2. 存在未化解异议优先
    if (a.hasUnresolvedObjection !== b.hasUnresolvedObjection) return a.hasUnresolvedObjection ? -1 : 1;
    // 3. 阶段位次靠后优先
    var rankDiff = (STAGE_RANK[b.customer.stage] || 0) - (STAGE_RANK[a.customer.stage] || 0);
    if (rankDiff !== 0) return rankDiff;
    // 4. 停留天数越长越优先
    if (b.stageDays !== a.stageDays) return b.stageDays - a.stageDays;
    // 5. 客户价值
    return b.valueScore - a.valueScore;
  });

  // 排序：断档风险
  breakRisk.sort(function (a, b) {
    var rankDiff = (STAGE_RANK[b.customer.stage] || 0) - (STAGE_RANK[a.customer.stage] || 0);
    if (rankDiff !== 0) return rankDiff;
    if (b.breakInfo.overdueDays !== a.breakInfo.overdueDays) return b.breakInfo.overdueDays - a.breakInfo.overdueDays;
    return b.valueScore - a.valueScore;
  });

  // 排序：该推进了
  shouldAdvance.sort(function (a, b) {
    var rankDiff = (STAGE_RANK[b.customer.stage] || 0) - (STAGE_RANK[a.customer.stage] || 0);
    if (rankDiff !== 0) return rankDiff;
    if (b.lastActionDate !== a.lastActionDate) return b.lastActionDate > a.lastActionDate ? 1 : -1;
    var smoothDiff = (a.lastCommResult === '顺利' ? 0 : 1) - (b.lastCommResult === '顺利' ? 0 : 1);
    if (smoothDiff !== 0) return smoothDiff;
    return b.valueScore - a.valueScore;
  });

  return { shouldAdvance: shouldAdvance, breakRisk: breakRisk, stuck: stuck };
}

module.exports = {
  classifyCustomers: classifyCustomers,
  RHYTHM_RULE_CONFIG: RHYTHM_RULE_CONFIG
};

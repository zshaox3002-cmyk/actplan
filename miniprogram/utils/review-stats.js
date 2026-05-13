/**
 * review-stats.js — 复盘页统计计算
 * 纯函数，输入 snapshot + 周期 → 输出各维度指标
 */

var dateUtil = require('./date');
var constants = require('./constants');
var rhythm = require('./rhythm');

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
  var appointmentCount = 0;
  var dealPolicyCount = 0;

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

  var plans = snapshot.plan || [];
  for (var m = 0; m < plans.length; m++) {
    var planDate = plans[m].plan_date || '';
    if (planDate >= start && planDate <= end) appointmentCount++;
  }

  var policies = snapshot.policy || [];
  for (var n = 0; n < policies.length; n++) {
    var effDate = (policies[n].effective_date || '').substring(0, 10);
    if (effDate >= start && effDate <= end) dealPolicyCount++;
  }

  return {
    visitCount: visitCount,
    newCustomers: newCustomers,
    stageAdvances: stageAdvances,
    dealCount: dealCount,
    appointmentCount: appointmentCount,
    dealPolicyCount: dealPolicyCount
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
  var total = 0;

  for (var i = 0; i < snapshot.visit_record.length; i++) {
    var r = snapshot.visit_record[i];
    if (r.visit_date < start || r.visit_date > end) continue;
    var way = r.visit_way || '其他';
    wayMap[way] = (wayMap[way] || 0) + 1;
    total++;
  }

  var result = [];
  var ways = constants.VISIT_WAY_OPTIONS;
  for (var j = 0; j < ways.length; j++) {
    var w = ways[j];
    var count = wayMap[w] || 0;
    if (count === 0) continue;
    result.push({
      way: w,
      count: count,
      countRate: total > 0 ? Math.round((count / total) * 100) : 0
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

var STAGE_CLASS_MAP = {
  '初步认识': 'meet',
  '需求沟通': 'comm',
  '方案讲解': 'present',
  '待促成':   'closing',
  '已成交':   'deal',
  '已流失':   'lost'
};

/**
 * 为每个客户添加节奏相关派生字段（非破坏性，返回新数组）
 * @param {Array} customers
 * @param {Array} records - 所有 visit_record 行
 * @param {Array} plans   - 所有 plan 行
 * @param {Array} objectionNotes - 所有 objection_note 行
 * @param {string} today  - 'YYYY-MM-DD'
 * @returns {Array} 富化后的客户数组
 */
function enrichCustomers(customers, records, plans, objectionNotes, today) {
  // 建立索引，避免 O(n²) 循环
  var recordIndex = {};
  for (var ri = 0; ri < records.length; ri++) {
    var cid = records[ri].customer_id;
    if (!recordIndex[cid]) recordIndex[cid] = [];
    recordIndex[cid].push(records[ri]);
  }

  var planIndex = {};
  for (var pi = 0; pi < plans.length; pi++) {
    var pcid = plans[pi].customer_id;
    if (!planIndex[pcid]) planIndex[pcid] = [];
    planIndex[pcid].push(plans[pi]);
  }

  var noteIndex = {};
  for (var ni = 0; ni < objectionNotes.length; ni++) {
    var ncid = objectionNotes[ni].customer_id;
    if (!noteIndex[ncid]) noteIndex[ncid] = [];
    noteIndex[ncid].push(objectionNotes[ni]);
  }

  // 一次性计算所有客户的节奏标签
  var tagList = rhythm.tagCustomers(customers, records, plans, objectionNotes, today);
  var tagMap = {};
  for (var ti = 0; ti < tagList.length; ti++) {
    tagMap[tagList[ti].customer_id] = tagList[ti];
  }

  return customers.map(function (c) {
    var cRecords = recordIndex[c.id] || [];
    var cPlans = planIndex[c.id] || [];
    var cNotes = noteIndex[c.id] || [];

    // stage_days
    var stageDateStr = (c.stage_updated_at || c.created_at || '').substring(0, 10);
    var stageDays = stageDateStr ? dateUtil.daysBetween(today, stageDateStr) : 0;

    // days_since_last_visit
    var daysSinceLastVisit = c.last_visit ? dateUtil.daysBetween(today, c.last_visit) : 9999;

    // plan 派生字段
    var hasFuturePlan = false;
    var nextPlanDate = null;
    var todayPlanCount = 0;
    var overduePlanCount = 0;
    var pendingPlanCount = 0;
    for (var i = 0; i < cPlans.length; i++) {
      var p = cPlans[i];
      if (p.status !== '待执行') continue;
      pendingPlanCount++;
      if (p.plan_date < today) {
        overduePlanCount++;
      } else if (p.plan_date === today) {
        todayPlanCount++;
        hasFuturePlan = true;
        if (!nextPlanDate || p.plan_date < nextPlanDate) nextPlanDate = p.plan_date;
      } else {
        hasFuturePlan = true;
        if (!nextPlanDate || p.plan_date < nextPlanDate) nextPlanDate = p.plan_date;
      }
    }

    // last_comm_result
    var lastCommResult = '';
    var latestRecord = null;
    for (var j = 0; j < cRecords.length; j++) {
      if (!latestRecord || cRecords[j].visit_date > latestRecord.visit_date) {
        latestRecord = cRecords[j];
      }
    }
    if (latestRecord) lastCommResult = latestRecord.comm_result || '';

    // has_unresolved_objection
    var hasUnresolvedObjection = false;
    var latestNote = null;
    for (var k = 0; k < cNotes.length; k++) {
      if (!latestNote || (cNotes[k].created_at || '') > (latestNote.created_at || '')) {
        latestNote = cNotes[k];
      }
    }
    if (latestNote) hasUnresolvedObjection = latestNote.result !== '已化解';

    // rhythm 字段
    var tagInfo = tagMap[c.id] || { rhythm_tag: 'normal', reason: '', detail: '' };
    var rhythmTag = tagInfo.rhythm_tag;
    var rhythmReason = tagInfo.reason;

    // suggested_action
    var suggestedAction = '';
    if (rhythmTag === 'stuck') {
      suggestedAction = hasUnresolvedObjection ? '查看异议' : '预约';
    } else if (rhythmTag === 'break_risk') {
      suggestedAction = '预约';
    } else if (rhythmTag === 'should_advance') {
      suggestedAction = '随手记';
    }

    return Object.assign({}, c, {
      stage_days: stageDays,
      days_since_last_visit: daysSinceLastVisit,
      has_future_plan: hasFuturePlan,
      next_plan_date: nextPlanDate,
      today_plan_count: todayPlanCount,
      overdue_plan_count: overduePlanCount,
      pending_plan_count: pendingPlanCount,
      last_comm_result: lastCommResult,
      has_unresolved_objection: hasUnresolvedObjection,
      rhythm_tag: rhythmTag,
      rhythm_reason: rhythmReason,
      suggested_action: suggestedAction
    });
  });
}

var TASK_TITLE_MAP = {
  break_risk_closing: '尽快确认客户意向',
  break_risk_default: '安排一次跟进',
  stuck_objection: '查看并处理客户异议',
  stuck_default: '推进卡点，安排下一步',
  should_advance: '安排下一次方案沟通'
};

/**
 * 生成无计划任务的标题
 * @param {string} taskType
 * @param {Object} enrichedCustomer
 * @returns {string}
 */
function _generateTaskTitle(taskType, enrichedCustomer) {
  if (taskType === 'break_risk') {
    return enrichedCustomer.stage === '待促成'
      ? TASK_TITLE_MAP.break_risk_closing
      : TASK_TITLE_MAP.break_risk_default;
  }
  if (taskType === 'stuck') {
    return enrichedCustomer.has_unresolved_objection
      ? TASK_TITLE_MAP.stuck_objection
      : TASK_TITLE_MAP.stuck_default;
  }
  if (taskType === 'should_advance') {
    return TASK_TITLE_MAP.should_advance;
  }
  return '安排跟进';
}

/**
 * 构建"今日要做"完整任务列表
 * @param {Object} snapshot - { customer, visit_record, plan, objection_note }
 * @param {string} today - 'YYYY-MM-DD'
 * @param {Object} dismissedSet - { [customerId+'|'+taskType]: true }
 * @returns {{ list: Array, total: number, empty_type: string }}
 */
function getTodayTasks(snapshot, today, dismissedSet) {
  try {
    var customers = snapshot.customer || [];
    if (customers.length === 0) {
      return { list: [], total: 0, empty_type: 'no_customer' };
    }

    var records = snapshot.visit_record || [];
    var plans = snapshot.plan || [];
    var objNotes = snapshot.objection_note || [];
    var dismissed = dismissedSet || {};

    var enriched = enrichCustomers(customers, records, plans, objNotes, today);

    // 建立客户 map
    var customerMap = {};
    for (var ci = 0; ci < enriched.length; ci++) {
      customerMap[enriched[ci].id] = enriched[ci];
    }

    var list = [];
    var seenCustomerIds = {};

    // Source A: 逾期计划（plan_date < today, status='待执行'）
    var overduePlans = [];
    for (var i = 0; i < plans.length; i++) {
      var p = plans[i];
      if (p.status === '待执行' && p.plan_date < today) overduePlans.push(p);
    }
    overduePlans.sort(function (a, b) { return a.plan_date < b.plan_date ? -1 : 1; });

    for (var oi = 0; oi < overduePlans.length; oi++) {
      var op = overduePlans[oi];
      var oc = customerMap[op.customer_id];
      if (!oc) continue;
      var overdueDays = dateUtil.daysBetween(today, op.plan_date);
      list.push({
        task_id: 'plan_' + op.id,
        task_type: 'overdue_plan',
        task_title: op.goal || '拜访计划',
        customer_id: oc.id,
        customer_name: oc.name,
        customer_stage: oc.stage,
        customer_stage_class: STAGE_CLASS_MAP[oc.stage] || 'comm',
        plan_id: op.id,
        plan_date: op.plan_date,
        plan_time: op.plan_time || '',
        visit_way: op.visit_way || '面对面',
        plan_goal: op.goal || '',
        has_active_plan: true,
        reason: '逾期 ' + overdueDays + ' 天',
        actions: ['执行', '修改', '删除']
      });
      seenCustomerIds[oc.id] = true;
    }

    // Source B: 今日计划（plan_date = today, status='待执行'）
    var todayPlans = [];
    for (var ti = 0; ti < plans.length; ti++) {
      var tp = plans[ti];
      if (tp.status === '待执行' && tp.plan_date === today) todayPlans.push(tp);
    }
    todayPlans.sort(function (a, b) {
      if (!a.plan_time && !b.plan_time) return 0;
      if (!a.plan_time) return 1;
      if (!b.plan_time) return -1;
      return a.plan_time < b.plan_time ? -1 : 1;
    });

    for (var tpi = 0; tpi < todayPlans.length; tpi++) {
      var tdp = todayPlans[tpi];
      var tdc = customerMap[tdp.customer_id];
      if (!tdc) continue;
      var timeStr = tdp.plan_time ? '今日 ' + tdp.plan_time : '今日';
      list.push({
        task_id: 'plan_' + tdp.id,
        task_type: 'today_plan',
        task_title: tdp.goal || '拜访计划',
        customer_id: tdc.id,
        customer_name: tdc.name,
        customer_stage: tdc.stage,
        customer_stage_class: STAGE_CLASS_MAP[tdc.stage] || 'comm',
        plan_id: tdp.id,
        plan_date: tdp.plan_date,
        plan_time: tdp.plan_time || '',
        visit_way: tdp.visit_way || '面对面',
        plan_goal: tdp.goal || '',
        has_active_plan: true,
        reason: timeStr,
        actions: ['执行', '修改', '删除']
      });
      seenCustomerIds[tdc.id] = true;
    }

    // Source C: 节奏任务（无未来计划，未被暂不处理）
    var RHYTHM_PRIORITY = { stuck: 0, break_risk: 1, should_advance: 2 };
    var rhythmTasks = [];
    for (var ri = 0; ri < enriched.length; ri++) {
      var rc = enriched[ri];
      var rtag = rc.rhythm_tag;
      if (rtag === 'normal' || rtag === 'should_advance') continue; // should_advance 不进行动页
      if (rc.has_future_plan) continue;
      if (seenCustomerIds[rc.id]) continue;
      var dismissKey = rc.id + '|' + rtag;
      if (dismissed[dismissKey]) continue;
      rhythmTasks.push(rc);
    }
    rhythmTasks.sort(function (a, b) {
      var pa = RHYTHM_PRIORITY[a.rhythm_tag] !== undefined ? RHYTHM_PRIORITY[a.rhythm_tag] : 99;
      var pb = RHYTHM_PRIORITY[b.rhythm_tag] !== undefined ? RHYTHM_PRIORITY[b.rhythm_tag] : 99;
      if (pa !== pb) return pa - pb;
      return (b.stage_days || 0) - (a.stage_days || 0);
    });

    for (var rri = 0; rri < rhythmTasks.length; rri++) {
      var rrc = rhythmTasks[rri];
      var rtaskType = rrc.rhythm_tag;
      var rActions = rtaskType === 'stuck'
        ? ['预约', '查看异议', '暂不处理']
        : ['预约', '随手记', '暂不处理'];
      list.push({
        task_id: 'rhythm_' + rrc.id + '_' + rtaskType,
        task_type: rtaskType,
        task_title: _generateTaskTitle(rtaskType, rrc),
        customer_id: rrc.id,
        customer_name: rrc.name,
        customer_stage: rrc.stage,
        customer_stage_class: STAGE_CLASS_MAP[rrc.stage] || 'comm',
        plan_id: null,
        has_active_plan: false,
        reason: rrc.rhythm_reason,
        actions: rActions
      });
    }

    var emptyType = list.length === 0 ? 'no_urgent_task' : '';
    return { list: list, total: list.length, empty_type: emptyType };
  } catch (e) {
    console.error('[getTodayTasks] error:', e);
    return { list: [], total: 0, empty_type: 'data_error' };
  }
}

module.exports = {
  getRanges: getRanges,
  getReviewMetrics: getReviewMetrics,
  getMethodComparison: getMethodComparison,
  getStageFlow: getStageFlow,
  getObjectionSummary: getObjectionSummary,
  enrichCustomers: enrichCustomers,
  getTodayTasks: getTodayTasks
};

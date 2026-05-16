/**
 * record.repo.js — 拜访记录 CRUD
 * 基于 storage.js + id.js
 * create() 必须走 storage.transaction，保证多表联动原子性
 */

var storage = require('../storage');
var id = require('../id');
var dateUtil = require('../date');
var constants = require('../constants');

/**
 * 查询所有拜访记录（按 visit_date 倒序）
 * @returns {Array<Object>}
 */
function list() {
  var all = storage.getTable('visit_record');
  return all.sort(function (a, b) {
    return (b.visit_date || '').localeCompare(a.visit_date || '');
  });
}

/**
 * 查询指定客户的拜访记录
 * @param {number} customerId
 * @returns {Array<Object>}
 */
function listByCustomer(customerId) {
  var all = storage.getTable('visit_record');
  return all
    .filter(function (r) { return r.customer_id === customerId; })
    .sort(function (a, b) {
      return (b.visit_date || '').localeCompare(a.visit_date || '');
    });
}

/**
 * 获取单条记录
 * @param {number} id
 * @returns {Object|null}
 */
function get(id) {
  var all = storage.getTable('visit_record');
  for (var i = 0; i < all.length; i++) {
    if (all[i].id === id) return all[i];
  }
  return null;
}

/**
 * 更新拜访记录的指定字段
 * @param {number} id - 记录 id
 * @param {Object} fields - 要更新的字段，如 { summary: '...' }
 */
function update(id, fields) {
  storage.transaction(function (ctx) {
    var all = ctx.getTableRef('visit_record');
    var idx = -1;
    for (var i = 0; i < all.length; i++) {
      if (all[i].id === id) { idx = i; break; }
    }
    if (idx === -1) throw new Error('record not found: ' + id);
    all[idx] = Object.assign({}, all[idx], fields, { updated_at: new Date().toISOString() });
    ctx.setTable('visit_record', all);
  });
}

/**
 * 新建拜访记录（事务）
 * 事务内操作：
 * 1. 插入 visit_record
 * 2. 更新 customer.last_visit / visit_count / updated_at
 * 3. 若 is_deal === '签单成交'，更新 customer.stage / stage_updated_at
 * 4. 若 plan_id 不为空，更新 plan.status = '已完成'
 *
 * @param {Object} data - 记录数据
 * @param {number} data.customer_id - 关联客户 ID
 * @param {string} data.visit_date - 拜访日期
 * @param {string} data.visit_way - 拜访方式
 * @param {string} data.summary - 沟通摘要
 * @param {string} data.is_deal - 成交状态
 * @param {string} [data.comm_result] - 沟通结果（顺利/一般/受阻/已成交）
 * @param {string} [data.record_type] - 记录类型（planned=计划内拜访 / adhoc=临时沟通）
 * @param {number|null} [data.plan_id] - 关联计划 ID
 * @param {number|null} [data.duration] - 拜访时长
 * @param {string|null} [data.next_follow_date] - 下次跟进日期
 * @param {number} [data.has_objection] - 是否关联异议
 * @param {Array} [data.updated_fields] - 本次更新的客户字段
 * @returns {number} 新记录 ID
 */
function create(data) {
  var newRecordId = null;

  storage.transaction(function (ctx) {
    var records = ctx.getTableRef('visit_record');
    var customers = ctx.getTableRef('customer');
    var plans = ctx.getTableRef('plan');

    var now = dateUtil.nowISO();
    newRecordId = id.nextId('visit_record');

    // 1. 插入拜访记录
    records.push({
      id: newRecordId,
      customer_id: data.customer_id,
      plan_id: data.plan_id || null,
      visit_date: data.visit_date,
      visit_time: data.visit_time || null,
      visit_way: data.visit_way || constants.VISIT_WAY.RANDOM,
      duration: data.duration || null,
      summary: data.summary || '',
      stage: data.stage || '',
      comm_result: data.comm_result || '',
      record_type: data.record_type || 'planned',
      updated_fields: data.updated_fields || [],
      is_deal: data.is_deal || constants.DEAL_STATUS.NO_DEAL,
      next_follow_date: data.next_follow_date || null,
      has_objection: data.has_objection || 0,
      objection_ids: data.objection_ids || [],
      created_at: now
    });

    // 2. 更新客户信息
    var customer = null;
    for (var i = 0; i < customers.length; i++) {
      if (customers[i].id === data.customer_id) {
        customer = customers[i];
        break;
      }
    }
    if (customer) {
      customer.last_visit = data.visit_date;
      customer.visit_count = (customer.visit_count || 0) + 1;
      customer.updated_at = now;

      // 3. 若成交，更新跟进阶段
      if (data.is_deal === constants.DEAL_STATUS.DEAL) {
        customer.stage = constants.STAGE.DEAL;
        customer.stage_updated_at = now;
      }
    }

    // 4. 若由计划触发，更新计划状态
    if (data.plan_id) {
      var plan = null;
      for (var j = 0; j < plans.length; j++) {
        if (plans[j].id === data.plan_id) {
          plan = plans[j];
          break;
        }
      }
      if (plan) {
        plan.status = constants.PLAN_STATUS.COMPLETED;
      }
    }

    // 5. 写回三张表
    ctx.setTable('visit_record', records);
    ctx.setTable('customer', customers);
    ctx.setTable('plan', plans);
  });

  return newRecordId;
}

/**
 * 删除拜访记录，重新计算客户 last_visit / visit_count
 * @param {number} recordId
 * @returns {{ planId: number|null }} 被删除记录关联的 plan_id
 */
function remove(recordId) {
  var planId = null;
  storage.transaction(function (ctx) {
    var records = ctx.getTableRef('visit_record');
    var customers = ctx.getTableRef('customer');

    var target = null;
    var newRecords = [];
    for (var i = 0; i < records.length; i++) {
      if (records[i].id === recordId) { target = records[i]; }
      else { newRecords.push(records[i]); }
    }
    if (!target) throw new Error('record not found: ' + recordId);

    planId = target.plan_id !== undefined ? target.plan_id : null;

    var remaining = newRecords.filter(function (r) {
      return r.customer_id === target.customer_id;
    });
    var newLastVisit = '';
    for (var j = 0; j < remaining.length; j++) {
      if (remaining[j].visit_date > newLastVisit) newLastVisit = remaining[j].visit_date;
    }

    for (var k = 0; k < customers.length; k++) {
      if (customers[k].id === target.customer_id) {
        customers[k].last_visit = newLastVisit || null;
        customers[k].visit_count = remaining.length;
        customers[k].updated_at = new Date().toISOString();
        break;
      }
    }

    ctx.setTable('visit_record', newRecords);
    ctx.setTable('customer', customers);
  });
  return { planId: planId };
}

module.exports = {
  list: list,
  listByCustomer: listByCustomer,
  get: get,
  create: create,
  update: update,
  remove: remove
};

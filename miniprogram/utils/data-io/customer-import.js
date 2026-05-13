/**
 * customer-import.js — 客户主数据导入
 *
 * previewXlsx(buffer) — 解析 xlsx ArrayBuffer，生成导入计划，不写 Storage
 * commit(plan)        — 按计划执行写入，使用 storage.transaction()
 */

var xlsx = require('../../lib/xlsx-simple');
var normalizer = require('./customer-normalizer');
var customerRepo = require('../repository/customer.repo');
var storage = require('../storage');
var dateUtil = require('../date');
var id = require('../id');

/**
 * 预检 xlsx ArrayBuffer，生成导入计划
 * @param {ArrayBuffer} buffer
 * @returns {Object} 预检结果
 */
function previewXlsx(buffer) {
  var rows = xlsx.parseXlsx(buffer);
  return _buildPlan(rows);
}

/**
 * 将解析后的行数组转为导入计划
 * @param {Array<Object>} rows
 * @returns {Object}
 * @private
 */
function _buildPlan(rows) {
  var result = {
    ok: false,
    totalRows: 0,
    validRows: 0,
    invalidRows: 0,
    actions: { create: 0, update: 0, skip: 0, error: 0 },
    errors: [],
    warnings: [],
    plan: []
  };

  if (rows.length === 0) {
    result.errors.push('文件为空或格式错误，未找到有效数据行');
    return result;
  }

  var allCustomers = customerRepo.list();
  var byName = {};
  for (var ci = 0; ci < allCustomers.length; ci++) {
    var c = allCustomers[ci];
    if (c.name) {
      if (!byName[c.name]) byName[c.name] = [];
      byName[c.name].push(c);
    }
  }

  var nonEmptyCount = 0;
  for (var i = 0; i < rows.length; i++) {
    var rawRow = rows[i];

    // 跳过全空行（模板占位行）
    var vals = Object.keys(rawRow).map(function (k) { return String(rawRow[k] || '').trim(); });
    if (vals.every(function (v) { return v === ''; })) continue;
    nonEmptyCount++;

    var normalized = normalizer.normalizeRow(rawRow, i);

    if (normalized.errors.length > 0) {
      result.invalidRows++;
      result.actions.error++;
      result.errors = result.errors.concat(normalized.errors);
      result.plan.push({
        row: i + 2,
        action: 'error',
        matchCustomerId: null,
        data: null,
        changedFields: [],
        reason: normalized.errors.join('；')
      });
      continue;
    }

    if (normalized.warnings.length > 0) {
      result.warnings = result.warnings.concat(normalized.warnings);
    }

    var data = normalized.data;
    var planItem = {
      row: i + 2,
      action: 'create',
      matchCustomerId: null,
      data: data,
      changedFields: [],
      reason: ''
    };

    if (data.name && byName[data.name] && byName[data.name].length > 0) {
      var suffix = _nextSuffix(data.name, byName);
      data.name = data.name + suffix;
      planItem.reason = '同名客户已存在，自动重命名为 ' + data.name;
      result.warnings.push('第' + (i + 2) + '行：存在同名客户，自动重命名为 "' + data.name + '"');
    }

    result.validRows++;
    result.actions.create++;
    result.plan.push(planItem);
  }

  result.totalRows = nonEmptyCount;
  result.ok = result.invalidRows === 0;
  return result;
}

/**
 * 按导入计划执行写入
 * @param {Array} plan - previewXlsx() 返回的 plan 数组
 * @returns {Object} 执行结果
 */
function commit(plan) {
  var created = 0;
  var updated = 0;
  var skipped = 0;
  var failed = 0;
  var customerIds = [];

  storage.transaction(function () {
    for (var i = 0; i < plan.length; i++) {
      var item = plan[i];

      if (item.action === 'error' || item.action === 'skip') {
        skipped++;
        continue;
      }

      try {
        if (item.action === 'create') {
          var res = customerRepo.create(item.data);
          customerIds.push(res.id);
          created++;
        } else if (item.action === 'update') {
          customerRepo.update(item.matchCustomerId, item.data);
          customerIds.push(item.matchCustomerId);
          updated++;
        }
      } catch (e) {
        failed++;
      }
    }

    var logs = storage.getTable('operation_log');
    logs.push({
      id: id.nextId('operation_log'),
      type: 'import_customer',
      created: created,
      updated: updated,
      skipped: skipped,
      failed: failed,
      created_at: dateUtil.nowISO()
    });
    storage.setTable('operation_log', logs);
  });

  return {
    success: true,
    created: created,
    updated: updated,
    skipped: skipped,
    failed: failed,
    customerIds: customerIds
  };
}

/**
 * 为同名客户生成下一个可用后缀字母（A/B/C...）
 * @param {string} baseName
 * @param {Object} byName
 * @returns {string}
 * @private
 */
function _nextSuffix(baseName, byName) {
  var letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (var i = 0; i < letters.length; i++) {
    var candidate = baseName + letters[i];
    if (!byName[candidate] || byName[candidate].length === 0) return letters[i];
  }
  return String(Date.now()).slice(-4);
}

module.exports = {
  previewXlsx: previewXlsx,
  commit: commit
};

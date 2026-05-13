/**
 * customer-export.js — 客户主数据导出和模板生成
 */

var customerRepo = require('../repository/customer.repo');
var schema = require('./customer-schema');
var csv = require('./csv');
var xlsx = require('../../lib/xlsx-simple');

/**
 * 导出所有客户为 CSV 文本
 * @returns {string} CSV 文本（不含 BOM）
 */
function exportCustomers() {
  var customers = customerRepo.list();
  var rows = customers.map(_customerToRow);
  return csv.buildCSV(schema.EXPORT_HEADERS, rows);
}

/**
 * 生成客户导入模板 CSV（含表头和一行示例数据）
 * @returns {string} CSV 文本（不含 BOM）
 */
function buildTemplate() {
  var example = {
    '外部编号': 'EXT001',
    '姓名': '张三',
    '性别': '男',
    '关系来源': '朋友',
    '年收入': '30–50万',
    '年龄段': '35–44岁',
    '职业': '企业管理层',
    '居住情况': '自住房（无贷）',
    '婚姻状况': '已婚–有子',
    '亲密度': '熟人',
    '跟进阶段': '需求沟通',
    '标签': '高潜力、转介绍',
    '高净值': '否',
    '转介绍数': '2',
    '生日': '03-15',
    '保单到期日': '2025-12-31',
    '家庭结构': '有未成年子女',
    '有需求': '是',
    '有能力': '是',
    '是决策者': '是',
    '保障缺口': '重疾保额不足',
    '重疾状态': 'gap',
    '医疗状态': 'unknown',
    '教育金状态': 'none',
    '养老状态': 'unknown',
    '意外状态': 'unknown',
    '寿险状态': 'gap',
    '最近拜访': '2026-04-20',
    '拜访次数': '3'
  };
  return csv.buildCSV(schema.IMPORT_HEADERS, [example]);
}

/**
 * 将客户对象转换为 CSV 行对象（key 为中文列名）
 * @param {Object} customer
 * @returns {Object}
 * @private
 */
function _customerToRow(customer) {
  var row = {};
  var cols = schema.COLUMNS;

  for (var i = 0; i < cols.length; i++) {
    var col = cols[i];

    if (col.type === 'coverage_status') {
      var 险种 = col.key.split('.')[1];
      var cs = customer.coverage_status || {};
      row[col.label] = cs[险种] || 'unknown';
      continue;
    }

    var val = customer[col.key];

    if (col.type === 'array') {
      row[col.label] = Array.isArray(val) ? val.join('、') : '';
      continue;
    }

    if (col.type === 'bool') {
      row[col.label] = val ? '是' : '否';
      continue;
    }

    row[col.label] = (val !== null && val !== undefined) ? String(val) : '';
  }

  return row;
}

/**
 * 导出所有客户为 xlsx 二进制（Uint8Array）
 * @returns {Uint8Array}
 */
function exportCustomersXlsx() {
  var customers = customerRepo.list();
  var rows = customers.map(_customerToRow);
  return xlsx.buildXlsx(schema.HEADERS, rows);
}

/**
 * 生成客户导入模板 xlsx 二进制（含表头和一行示例数据）
 * @returns {Uint8Array}
 */
function buildTemplateXlsx() {
  var example = {
    '姓名': '张三',
    '性别': '男',
    '关系来源': '朋友',
    '年收入': '30–50万',
    '年龄段': '35–44岁',
    '职业': '企业管理层',
    '居住情况': '自住房（无贷）',
    '婚姻状况': '已婚–有子',
    '亲密度': '熟人',
    '跟进阶段': '需求沟通'
  };

  // 为所有枚举字段生成下拉菜单
  var validations = [];
  for (var i = 0; i < schema.COLUMNS.length; i++) {
    var col = schema.COLUMNS[i];
    if (col.type === 'enum' && col.enumValues && col.enumValues.length > 0) {
      validations.push({ col: i, values: col.enumValues });
    }
  }

  var rows = [example];
  for (var i = 0; i < 10; i++) {
    rows.push({});
  }
  return xlsx.buildXlsx(schema.HEADERS, rows, validations);
}

module.exports = {
  exportCustomers: exportCustomers,
  buildTemplate: buildTemplate,
  exportCustomersXlsx: exportCustomersXlsx,
  buildTemplateXlsx: buildTemplateXlsx
};

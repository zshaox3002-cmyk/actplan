/**
 * customer-normalizer.js — 客户 CSV/xlsx 行字段清洗与校验
 */

var schema = require('./customer-schema');

/**
 * 校验并清洗单行数据
 * @param {Object} rawRow - key 为中文列名
 * @param {number} rowIndex
 * @returns {{ errors: string[], warnings: string[], data: Object|null }}
 */
function normalizeRow(rawRow, rowIndex) {
  var lineNum = rowIndex + 2;
  var errors = [];
  var warnings = [];
  var data = {};

  var cols = schema.COLUMNS;

  for (var i = 0; i < cols.length; i++) {
    var col = cols[i];
    var raw = rawRow[col.label];
    if (raw === undefined) raw = '';
    raw = String(raw).trim();

    if (col.required && !raw) {
      errors.push('第' + lineNum + '行：' + col.label + ' 为必填项');
      continue;
    }

    if (!raw) {
      data[col.key] = '';
      continue;
    }

    if (col.type === 'enum' && col.enumValues && col.enumValues.indexOf(raw) === -1) {
      warnings.push('第' + lineNum + '行：' + col.label + ' 值 "' + raw + '" 不在预设枚举中，将原样导入');
    }

    data[col.key] = raw;
  }

  if (errors.length > 0) return { errors: errors, warnings: warnings, data: null };
  return { errors: [], warnings: warnings, data: data };
}

module.exports = {
  normalizeRow: normalizeRow
};

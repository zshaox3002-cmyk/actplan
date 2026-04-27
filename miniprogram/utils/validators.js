/**
 * validators.js — 表单校验工具
 * 校验失败返回错误文案，成功返回 null
 */

/**
 * 必填校验
 * @param {*} value - 待校验值
 * @param {string} fieldName - 字段中文名
 * @returns {string|null} 错误文案或 null
 */
function required(value, fieldName) {
  fieldName = fieldName || '此字段';
  if (value === null || value === undefined || value === '') {
    return fieldName + '为必填项';
  }
  if (typeof value === 'string' && !value.trim()) {
    return fieldName + '为必填项';
  }
  return null;
}

/**
 * 日期格式校验（YYYY-MM-DD）
 * @param {string} value - 日期字符串
 * @returns {string|null} 错误文案或 null
 */
function isValidDate(value) {
  if (!value) return null;
  var match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '日期格式不正确，应为 YYYY-MM-DD';
  var y = parseInt(match[1], 10);
  var m = parseInt(match[2], 10);
  var d = parseInt(match[3], 10);
  if (m < 1 || m > 12) return '月份应在1-12之间';
  if (d < 1 || d > 31) return '日期应在1-31之间';
  if (y < 2000 || y > 2100) return '年份应在2000-2100之间';
  return null;
}

/**
 * 正数校验
 * @param {*} value - 待校验值
 * @returns {string|null} 错误文案或 null
 */
function isPositiveNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  var num = Number(value);
  if (isNaN(num)) return '请输入有效数字';
  if (num <= 0) return '请输入正数';
  return null;
}

/**
 * 批量校验：按顺序执行，返回第一个错误
 * @param {Array<{check: Function}>} rules - 校验规则数组
 * @returns {string|null} 第一个错误文案或 null
 */
function validate(rules) {
  for (var i = 0; i < rules.length; i++) {
    var err = rules[i].check();
    if (err) return err;
  }
  return null;
}

module.exports = {
  required: required,
  isValidDate: isValidDate,
  isPositiveNumber: isPositiveNumber,
  validate: validate
};

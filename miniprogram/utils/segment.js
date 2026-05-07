/**
 * segment.js — 客户视图规则引擎（v1.1 新增）
 * 纯函数，禁止读写 storage。所有判定函数输入 → 输出，无副作用。
 */

var INTIMACY_MAP = {
  '陌生': 1, '普通朋友': 2, '熟人': 3, '好友': 4, '亲密': 5
};

/**
 * 将 intimacy 字段统一转为数字（兼容字符串和数字两种存储格式）
 * @param {string|number} val
 * @returns {number}
 */
function _intimacyToNum(val) {
  if (typeof val === 'number') return val;
  return INTIMACY_MAP[val] || 0;
}

/**
 * 计算两个日期之间的天数差（today - date），date 在未来时为负数
 * @param {string} dateStr - YYYY-MM-DD
 * @param {string} today - YYYY-MM-DD
 * @returns {number}
 */
function _daysDiff(dateStr, today) {
  if (!dateStr) return null;
  return Math.round((new Date(today) - new Date(dateStr)) / 86400000);
}

/**
 * 判断生日是否在 N 天内（跨年处理）
 * @param {string|null} birthday - MM-DD
 * @param {string} today - YYYY-MM-DD
 * @param {number} days
 * @returns {boolean}
 */
function _birthdayWithinDays(birthday, today, days) {
  if (!birthday) return false;
  var year = today.substring(0, 4);
  var thisYearBirthday = year + '-' + birthday;
  var diff = Math.round((new Date(thisYearBirthday) - new Date(today)) / 86400000);
  if (diff < 0) {
    // 今年已过，看明年
    thisYearBirthday = (parseInt(year) + 1) + '-' + birthday;
    diff = Math.round((new Date(thisYearBirthday) - new Date(today)) / 86400000);
  }
  return diff >= 0 && diff <= days;
}

/**
 * 从 customer 对象中解析规则字段的实际值
 * @param {Object} customer - 已富化（含派生字段）的客户对象
 * @param {string} field - 规则字段名
 * @param {string} today - YYYY-MM-DD
 * @returns {*}
 */
function _resolveField(customer, field, today) {
  // coverage_status.{险种}
  if (field.indexOf('coverage_status.') === 0) {
    var type = field.substring('coverage_status.'.length);
    return customer.coverage_status ? customer.coverage_status[type] : 'unknown';
  }
  // coverage_status_any：任一险种状态
  if (field === 'coverage_status_any') {
    return customer.coverage_status || {};
  }
  // 派生字段
  if (field === 'policy_count') return customer.policy_count || 0;
  if (field === 'total_premium') return customer.total_premium || 0;
  if (field === 'avg_premium') return customer.avg_premium || 0;
  // 时间距离字段
  if (field === 'days_since_last_visit') {
    var d = _daysDiff(customer.last_visit, today);
    return d === null ? 9999 : d;
  }
  if (field === 'days_to_next_plan') {
    var d2 = _daysDiff(today, customer.next_follow_date);
    return d2 === null ? 9999 : -d2; // 未来为正数
  }
  // intimacy 统一转数字
  if (field === 'intimacy') return _intimacyToNum(customer.intimacy);
  // 时机字段（特殊处理，返回 boolean）
  if (field === 'birthday_within_days') return customer.birthday || null;
  if (field === 'policy_expire_within_days') return customer.policy_expire_date || null;
  // 其他字段直接取
  return customer[field];
}

/**
 * 单条规则匹配
 * @param {Object} customer
 * @param {Object} rule - { field, op, value } 或嵌套 { match, rules }
 * @param {string} today
 * @returns {boolean}
 */
function _matchRule(customer, rule, today) {
  // 嵌套子组
  if (rule.match && rule.rules) {
    return _matchGroup(customer, rule, today);
  }

  var field = rule.field;
  var op = rule.op;
  var value = rule.value;

  // 时机字段特殊处理
  if (field === 'birthday_within_days') {
    return _birthdayWithinDays(customer.birthday, today, value);
  }
  if (field === 'policy_expire_within_days') {
    if (!customer.policy_expire_date) return false;
    var diff = _daysDiff(customer.policy_expire_date, today);
    return diff !== null && diff >= 0 && diff <= value;
  }

  // coverage_status_any：任一险种等于某状态
  if (field === 'coverage_status_any') {
    var statusMap = customer.coverage_status || {};
    var types = Object.keys(statusMap);
    for (var i = 0; i < types.length; i++) {
      if (statusMap[types[i]] === value) return true;
    }
    return false;
  }

  // tags 字段
  if (field === 'tags') {
    var tags = customer.tags || [];
    if (op === 'contains_any') {
      for (var j = 0; j < value.length; j++) {
        if (tags.indexOf(value[j]) !== -1) return true;
      }
      return false;
    }
    if (op === 'contains_all') {
      for (var k = 0; k < value.length; k++) {
        if (tags.indexOf(value[k]) === -1) return false;
      }
      return true;
    }
    if (op === 'not_contains') {
      for (var m = 0; m < value.length; m++) {
        if (tags.indexOf(value[m]) !== -1) return false;
      }
      return true;
    }
    return false;
  }

  var actual = _resolveField(customer, field, today);

  switch (op) {
    case 'eq':  return actual === value;
    case 'neq': return actual !== value;
    case 'gte': return actual >= value;
    case 'lte': return actual <= value;
    case 'gt':  return actual > value;
    case 'lt':  return actual < value;
    case 'in':  return Array.isArray(value) && value.indexOf(actual) !== -1;
    case 'between':
      return Array.isArray(value) && actual >= value[0] && actual <= value[1];
    default:    return false;
  }
}

/**
 * 规则组匹配（支持 AND / OR，支持嵌套）
 * @param {Object} customer
 * @param {Object} group - { match: 'AND'|'OR', rules: [] }
 * @param {string} today
 * @returns {boolean}
 */
function _matchGroup(customer, group, today) {
  var rules = group.rules || [];
  var isAnd = (group.match || 'AND') === 'AND';

  for (var i = 0; i < rules.length; i++) {
    var result = _matchRule(customer, rules[i], today);
    if (isAnd && !result) return false;
    if (!isAnd && result) return true;
  }

  return isAnd; // AND 全部通过返回 true；OR 全部未命中返回 false
}

/**
 * 单客户规则匹配
 * @param {Object} customer - 已富化（含派生字段）的客户对象
 * @param {Object} rules - { version, match, rules }
 * @param {string} today - YYYY-MM-DD
 * @returns {boolean}
 */
function matchCustomer(customer, rules, today) {
  if (!rules || !rules.rules) return true;
  return _matchGroup(customer, rules, today);
}

/**
 * 对客户列表应用视图规则，返回命中的客户列表（已排序）
 * @param {Array} customers - 已富化（含派生字段）的客户数组
 * @param {Object} segmentRules - db_segment.rules JSON
 * @param {Object} segmentSort - db_segment.sort JSON
 * @returns {Array}
 */
function applySegment(customers, segmentRules, segmentSort) {
  var now = new Date();
  var today = now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0');

  var matched = customers.filter(function (c) {
    return matchCustomer(c, segmentRules, today);
  });

  if (segmentSort && segmentSort.field) {
    var sortField = segmentSort.field;
    var isDesc = (segmentSort.order || 'desc') === 'desc';

    matched.sort(function (a, b) {
      var aVal = _resolveField(a, sortField, today);
      var bVal = _resolveField(b, sortField, today);
      if (aVal === null || aVal === undefined) aVal = isDesc ? -Infinity : Infinity;
      if (bVal === null || bVal === undefined) bVal = isDesc ? -Infinity : Infinity;
      if (aVal < bVal) return isDesc ? 1 : -1;
      if (aVal > bVal) return isDesc ? -1 : 1;
      return 0;
    });
  }

  return matched;
}

module.exports = {
  applySegment: applySegment,
  matchCustomer: matchCustomer
};

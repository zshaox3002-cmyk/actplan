/**
 * plan-digest.js — 计划聚合摘要纯函数
 * 为计划页顶部"即将到期"和"逾期"卡片提供数据
 * 不依赖任何 wx API，纯函数，可单独测试
 */

/**
 * 格式化日期为人性化显示
 * @param {string} dateStr YYYY-MM-DD
 * @param {Date} [today] 基准日期，默认今天
 * @returns {string} "今天 周一" / "明天 周二" / "5月3日 周日"
 */
function formatHumanDate(dateStr, today) {
  today = today || new Date();
  var target = new Date(dateStr);
  // 用日期字符串比较避免时区问题
  var todayStr = _toDateStr(today);
  var targetStr = dateStr;

  var weekNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  var week = weekNames[target.getDay()];

  var diffDays = _diffDays(targetStr, todayStr);
  if (diffDays === 0) return '今天 ' + week;
  if (diffDays === 1) return '明天 ' + week;
  if (diffDays === 2) return '后天 ' + week;
  if (diffDays === -1) return '昨天 ' + week;
  var m = target.getMonth() + 1;
  var d = target.getDate();
  return m + '月' + d + '日 ' + week;
}

/**
 * 获取即将到期的计划（今天至未来 N 天内，待执行）
 * @param {Array} allPlans plan 表全量
 * @param {number} [days=30] 时间窗口
 * @param {Date} [today]
 * @returns {Array} 按日期+时间升序排列，每条附加 humanDate 字段
 */
function getUpcomingPlans(allPlans, days, today) {
  days = days || 30;
  today = today || new Date();
  var todayStr = _toDateStr(today);
  var endDate = new Date(today);
  endDate.setDate(endDate.getDate() + days);
  var endStr = _toDateStr(endDate);

  var upcoming = allPlans.filter(function (p) {
    return p.status === '待执行'
      && p.plan_date >= todayStr
      && p.plan_date <= endStr;
  });

  upcoming.sort(function (a, b) {
    if (a.plan_date !== b.plan_date) {
      return a.plan_date < b.plan_date ? -1 : 1;
    }
    var aHas = !!a.plan_time;
    var bHas = !!b.plan_time;
    if (aHas && !bHas) return -1;
    if (!aHas && bHas) return 1;
    if (aHas && bHas && a.plan_time !== b.plan_time) {
      return a.plan_time < b.plan_time ? -1 : 1;
    }
    return 0;
  });

  return upcoming.map(function (p) {
    return Object.assign({}, p, { humanDate: formatHumanDate(p.plan_date, today) });
  });
}

/**
 * 获取已逾期计划（plan_date < today 且 status='待执行'）
 * @param {Array} allPlans
 * @param {Date} [today]
 * @returns {Array}
 */
function getOverduePlans(allPlans, today) {
  today = today || new Date();
  var todayStr = _toDateStr(today);
  return allPlans.filter(function (p) {
    return p.status === '待执行' && p.plan_date < todayStr;
  });
}

/** 日期转 YYYY-MM-DD 字符串 */
function _toDateStr(d) {
  var y = d.getFullYear();
  var m = d.getMonth() + 1;
  var day = d.getDate();
  return y + '-' + (m < 10 ? '0' + m : '' + m) + '-' + (day < 10 ? '0' + day : '' + day);
}

/** 计算两个 YYYY-MM-DD 之间相差的天数 */
function _diffDays(dateStr1, dateStr2) {
  var d1 = new Date(dateStr1);
  var d2 = new Date(dateStr2);
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  return Math.round((d1 - d2) / 86400000);
}

module.exports = {
  formatHumanDate: formatHumanDate,
  getUpcomingPlans: getUpcomingPlans,
  getOverduePlans: getOverduePlans
};

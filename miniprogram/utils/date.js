/**
 * date.js — 日期工具函数
 * 纯函数，不依赖 Storage
 */

/** 星期名称 */
var WEEKDAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

/**
 * 获取 anchorDate 所在周的起止日期（周一~周日）
 * @param {Date|string} [anchorDate] - 锚点日期，默认今天
 * @returns {[string, string]} [周一日期, 周日日期]，格式 'YYYY-MM-DD'
 */
function getWeekRange(anchorDate) {
  var d = anchorDate ? new Date(anchorDate) : new Date();
  var day = d.getDay();
  // 周日=0 → 偏移-6，周一=1 → 偏移0，周六=6 → 偏移-5
  var diff = day === 0 ? -6 : 1 - day;

  var monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);

  var sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return [formatDate(monday, 'YYYY-MM-DD'), formatDate(sunday, 'YYYY-MM-DD')];
}

/**
 * 获取 anchorDate 所在月的起止日期
 * @param {Date|string} [anchorDate] - 锚点日期，默认今天
 * @returns {[string, string]} [月初日期, 月末日期]，格式 'YYYY-MM-DD'
 */
function getMonthRange(anchorDate) {
  var d = anchorDate ? new Date(anchorDate) : new Date();
  var firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
  var lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);

  return [formatDate(firstDay, 'YYYY-MM-DD'), formatDate(lastDay, 'YYYY-MM-DD')];
}

/**
 * 格式化日期
 * @param {Date|string} date - 日期对象或日期字符串
 * @param {string} [pattern] - 格式模式，默认 'YYYY-MM-DD'
 *   支持：YYYY-MM-DD, MM/DD, M月D日, YYYY-MM-DD HH:mm
 * @returns {string} 格式化后的字符串
 */
function formatDate(date, pattern) {
  if (typeof date === 'string') {
    date = new Date(date);
  }
  pattern = pattern || 'YYYY-MM-DD';

  var y = date.getFullYear();
  var m = date.getMonth() + 1;
  var d = date.getDate();
  var h = date.getHours();
  var min = date.getMinutes();

  var mm = m < 10 ? '0' + m : '' + m;
  var dd = d < 10 ? '0' + d : '' + d;
  var hh = h < 10 ? '0' + h : '' + h;
  var mmin = min < 10 ? '0' + min : '' + min;

  switch (pattern) {
    case 'YYYY-MM-DD':
      return y + '-' + mm + '-' + dd;
    case 'MM/DD':
      return mm + '/' + dd;
    case 'M月D日':
      return m + '月' + d + '日';
    case 'YYYY-MM-DD HH:mm':
      return y + '-' + mm + '-' + dd + ' ' + hh + ':' + mmin;
    default:
      return y + '-' + mm + '-' + dd;
  }
}

/**
 * 获取某一周的 7 天日期数组（周一~周日）
 * @param {Date|string} [anchorDate] - 锚点日期，默认今天
 * @returns {Array<{date: string, day: number, weekday: string, isToday: boolean}>}
 */
function getWeekDays(anchorDate) {
  var d = anchorDate ? new Date(anchorDate) : new Date();
  var day = d.getDay();
  var diff = day === 0 ? -6 : 1 - day;

  var monday = new Date(d);
  monday.setDate(d.getDate() + diff);

  var today = formatDate(new Date(), 'YYYY-MM-DD');
  var days = [];

  for (var i = 0; i < 7; i++) {
    var current = new Date(monday);
    current.setDate(monday.getDate() + i);
    var dateStr = formatDate(current, 'YYYY-MM-DD');
    days.push({
      date: dateStr,
      day: current.getDate(),
      weekday: WEEKDAY_NAMES[current.getDay()],
      isToday: dateStr === today
    });
  }

  return days;
}

/**
 * 切换到上一周/下一周的锚点日期
 * @param {string} currentDate - 当前锚点日期 'YYYY-MM-DD'
 * @param {number} offset - 周偏移量（-1 上一周，+1 下一周）
 * @returns {string} 新锚点日期
 */
function shiftWeek(currentDate, offset) {
  var d = new Date(currentDate);
  d.setDate(d.getDate() + offset * 7);
  return formatDate(d, 'YYYY-MM-DD');
}

/**
 * 生成当前 ISO 时间字符串（用于 created_at 等字段）
 * @returns {string} 格式 'YYYY-MM-DD HH:mm:ss'
 */
function nowISO() {
  var d = new Date();
  var y = d.getFullYear();
  var m = d.getMonth() + 1;
  var day = d.getDate();
  var h = d.getHours();
  var min = d.getMinutes();
  var s = d.getSeconds();

  var mm = m < 10 ? '0' + m : '' + m;
  var dd = day < 10 ? '0' + day : '' + day;
  var hh = h < 10 ? '0' + h : '' + h;
  var mmin = min < 10 ? '0' + min : '' + min;
  var ss = s < 10 ? '0' + s : '' + s;

  return y + '-' + mm + '-' + dd + ' ' + hh + ':' + mmin + ':' + ss;
}

module.exports = {
  getWeekRange: getWeekRange,
  getMonthRange: getMonthRange,
  formatDate: formatDate,
  getWeekDays: getWeekDays,
  shiftWeek: shiftWeek,
  nowISO: nowISO
};

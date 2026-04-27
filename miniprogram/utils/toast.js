/**
 * toast.js — 统一 Toast 封装
 * 职责：success / fail / warn 三种类型，统一 icon 和 duration
 */

var DEFAULT_DURATION = 2000;

/**
 * 成功提示
 * @param {string} text - 提示文案
 */
function success(text) {
  wx.showToast({
    title: text || '操作成功',
    icon: 'success',
    duration: DEFAULT_DURATION
  });
}

/**
 * 失败提示
 * @param {string} text - 提示文案
 */
function fail(text) {
  wx.showToast({
    title: text || '操作失败',
    icon: 'none',
    duration: DEFAULT_DURATION
  });
}

/**
 * 警告提示
 * @param {string} text - 提示文案
 */
function warn(text) {
  wx.showToast({
    title: text || '请注意',
    icon: 'none',
    duration: 3000
  });
}

module.exports = {
  success: success,
  fail: fail,
  warn: warn
};

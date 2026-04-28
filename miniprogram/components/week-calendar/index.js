/**
 * week-calendar — 周/月视图日历组件
 * Props:
 *   selectedDate: string  — 当前选中日期 'YYYY-MM-DD'
 *   markedDates: Array     — 有计划的日期数组 ['2026-04-23', ...]
 * Events:
 *   select — 日期被选中，e.detail = { date: 'YYYY-MM-DD' }
 */

var dateUtil = require('../../utils/date');

Component({
  properties: {
    selectedDate: {
      type: String,
      value: ''
    },
    markedDates: {
      type: Array,
      value: []
    }
  },

  data: {
    viewMode: 'week',   // 'week' | 'month'
    weekDays: [],
    weekLabel: '',
    monthDays: [],
    monthLabel: '',
    anchorDate: ''
  },

  lifetimes: {
    attached: function () {
      var anchor = this.data.selectedDate || dateUtil.formatDate(new Date(), 'YYYY-MM-DD');
      this.setData({ anchorDate: anchor });
      this._refreshWeek(anchor);
    }
  },

  observers: {
    'selectedDate': function (val) {
      if (val && val !== this.data.anchorDate) {
        this.setData({ anchorDate: val });
        if (this.data.viewMode === 'week') {
          this._refreshWeek(val);
        } else {
          this._refreshMonth(val);
        }
      }
    },
    'markedDates': function () {
      // markedDates 变化时重新叠加 isMarked
      if (this.data.viewMode === 'week') {
        var marked = this._buildDaysWithMarks(this.data.weekDays);
        this.setData({ weekDays: marked });
      } else {
        var markedMonth = this._buildDaysWithMarks(this.data.monthDays);
        this.setData({ monthDays: markedMonth });
      }
    }
  },

  methods: {
    /**
     * 在日期格子数组上叠加 isMarked 字段
     * 使用对象 set 替代 indexOf，规避 WXML 不支持 indexOf 的平台限制
     * @param {Array} days
     * @returns {Array}
     */
    _buildDaysWithMarks: function (days) {
      var markedDates = this.data.markedDates;
      var markedSet = {};
      for (var k = 0; k < markedDates.length; k++) {
        markedSet[markedDates[k]] = true;
      }
      return days.map(function (day) {
        return Object.assign({}, day, { isMarked: !!markedSet[day.date] });
      });
    },

    /** 刷新周视图数据 */
    _refreshWeek: function (anchorDate) {
      var days = dateUtil.getWeekDays(anchorDate);
      var range = dateUtil.getWeekRange(anchorDate);
      var startParts = range[0].split('-');
      var endParts = range[1].split('-');
      var label = parseInt(startParts[1]) + '/' + parseInt(startParts[2])
        + ' - ' + parseInt(endParts[1]) + '/' + parseInt(endParts[2]);

      this.setData({
        weekDays: this._buildDaysWithMarks(days),
        weekLabel: label
      });
    },

    /** 刷新月视图数据 */
    _refreshMonth: function (anchorDate) {
      var days = dateUtil.getMonthDays(anchorDate);
      var d = new Date(anchorDate);
      var label = d.getFullYear() + '年' + (d.getMonth() + 1) + '月';

      this.setData({
        monthDays: this._buildDaysWithMarks(days),
        monthLabel: label
      });
    },

    /** 切换周/月视图 */
    onToggleView: function (e) {
      var newMode = e.currentTarget.dataset.mode;
      if (newMode === this.data.viewMode) return;
      this.setData({ viewMode: newMode });
      if (newMode === 'month') {
        this._refreshMonth(this.data.anchorDate);
      } else {
        this._refreshWeek(this.data.anchorDate);
      }
    },

    /** 点击日期 */
    onDayTap: function (e) {
      var date = e.currentTarget.dataset.date;
      this.setData({ anchorDate: date });
      if (this.data.viewMode === 'month') {
        this._refreshMonth(date);
      }
      this.triggerEvent('select', { date: date });
    },

    /** 上一周 / 上一月 */
    onPrevWeek: function () {
      var newAnchor;
      if (this.data.viewMode === 'week') {
        newAnchor = dateUtil.shiftWeek(this.data.anchorDate, -1);
        this.setData({ anchorDate: newAnchor });
        this._refreshWeek(newAnchor);
      } else {
        newAnchor = dateUtil.shiftMonth(this.data.anchorDate, -1);
        this.setData({ anchorDate: newAnchor });
        this._refreshMonth(newAnchor);
      }
      this.triggerEvent('select', { date: newAnchor });
    },

    /** 下一周 / 下一月 */
    onNextWeek: function () {
      var newAnchor;
      if (this.data.viewMode === 'week') {
        newAnchor = dateUtil.shiftWeek(this.data.anchorDate, 1);
        this.setData({ anchorDate: newAnchor });
        this._refreshWeek(newAnchor);
      } else {
        newAnchor = dateUtil.shiftMonth(this.data.anchorDate, 1);
        this.setData({ anchorDate: newAnchor });
        this._refreshMonth(newAnchor);
      }
      this.triggerEvent('select', { date: newAnchor });
    }
  }
});

/**
 * week-calendar — 周视图日历组件
 * Props:
 *   selectedDate: string  — 当前选中日期 'YYYY-MM-DD'
 *   markedDates: Array     — 有计划的日期数组 ['2026-04-23', ...]
 * Events:
 *   select — 日期被选中，e.detail = { date: 'YYYY-MM-DD' }
 *   shift  — 切换周，e.detail = { anchorDate: 'YYYY-MM-DD' }
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
    weekDays: [],
    weekLabel: '',
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
        this._refreshWeek(val);
      }
    }
  },

  methods: {
    /** 刷新周视图数据 */
    _refreshWeek: function (anchorDate) {
      var days = dateUtil.getWeekDays(anchorDate);
      var range = dateUtil.getWeekRange(anchorDate);
      // 周标签：4/21 - 4/27
      var startParts = range[0].split('-');
      var endParts = range[1].split('-');
      var label = parseInt(startParts[1]) + '/' + parseInt(startParts[2]) + ' - ' + parseInt(endParts[1]) + '/' + parseInt(endParts[2]);

      this.setData({
        weekDays: days,
        weekLabel: label
      });
    },

    /** 点击日期 */
    onDayTap: function (e) {
      var date = e.currentTarget.dataset.date;
      this.triggerEvent('select', { date: date });
    },

    /** 上一周 */
    onPrevWeek: function () {
      var newAnchor = dateUtil.shiftWeek(this.data.anchorDate, -1);
      this.setData({ anchorDate: newAnchor });
      this._refreshWeek(newAnchor);
      this.triggerEvent('select', { date: newAnchor });
    },

    /** 下一周 */
    onNextWeek: function () {
      var newAnchor = dateUtil.shiftWeek(this.data.anchorDate, 1);
      this.setData({ anchorDate: newAnchor });
      this._refreshWeek(newAnchor);
      this.triggerEvent('select', { date: newAnchor });
    }
  }
});

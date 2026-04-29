/**
 * calendar/index.js — 日历看板
 * 以时间维度展示计划和拜访记录
 */

var storage = require('../../utils/storage');
var planRepo = require('../../utils/repository/plan.repo');
var recordRepo = require('../../utils/repository/record.repo');
var customerRepo = require('../../utils/repository/customer.repo');
var dateUtil = require('../../utils/date');
var constants = require('../../utils/constants');

Page({
  data: {
    viewMode: 'week',           // 'week' | 'month'
    anchorDate: '',             // 当前锚点日期
    selectedDate: '',           // 选中的日期
    weekDays: [],               // 周视图数据
    monthDays: [],              // 月视图数据
    events: [],                 // 选中日期的事件列表
    loading: true
  },

  onLoad: function () {
    storage.waitReady().then(() => {
      this._initCalendar();
    });
  },

  onShow: function () {
    this._loadData();
  },

  /**
   * 初始化日历：设置锚点为今天，加载数据
   */
  _initCalendar: function () {
    var today = dateUtil.today();
    var self = this;
    this.setData({
      anchorDate: today,
      selectedDate: today
    }, function () {
      // setData 完成后再加载数据
      self._loadData();
    });
  },

  /**
   * 加载计划和记录数据，构建标记日期集合，渲染当日事件
   */
  _loadData: function () {
    var self = this;
    var today = dateUtil.today();

    // 全量加载计划和记录
    var allPlans = planRepo.listAll();
    var allRecords = recordRepo.list();
    var allCustomers = customerRepo.listAll();

    // 构建客户 ID → 客户对象的映射
    var customerMap = {};
    allCustomers.forEach(function (c) {
      customerMap[c.id] = c;
    });

    // 构建标记日期集合（有计划或记录的日期）
    var markedDates = new Set();
    allPlans.forEach(function (p) {
      markedDates.add(p.plan_date);
    });
    allRecords.forEach(function (r) {
      markedDates.add(r.visit_date);
    });

    // 缓存到页面实例（不放 data，避免序列化）
    this._allPlans = allPlans;
    this._allRecords = allRecords;
    this._customerMap = customerMap;
    this._markedDates = markedDates;

    this.setData({
      loading: false
    });

    // 刷新日历视图和当日事件
    this._refreshCalendarView();
    this._loadDayEvents(this.data.selectedDate);
  },

  /**
   * 根据 viewMode 和 anchorDate 刷新日历视图
   */
  _refreshCalendarView: function () {
    var anchorDate = this.data.anchorDate;
    var viewMode = this.data.viewMode;

    if (viewMode === 'week') {
      var weekDays = dateUtil.getWeekDays(anchorDate);
      console.log('[calendar] getWeekDays result:', weekDays);
      weekDays = this._buildDaysWithMarks(weekDays);
      console.log('[calendar] after buildDaysWithMarks:', weekDays);
      this.setData({ weekDays: weekDays });
    } else {
      var monthDays = dateUtil.getMonthDays(anchorDate);
      monthDays = this._buildDaysWithMarks(monthDays);
      this.setData({ monthDays: monthDays });
    }
  },

  /**
   * 为日期数组叠加标记信息
   * @param {Array} days
   * @returns {Array}
   */
  _buildDaysWithMarks: function (days) {
    var markedDates = this._markedDates || new Set();
    var selectedDate = this.data.selectedDate;
    var today = dateUtil.today();

    return days.map(function (day) {
      return {
        date: day.date,
        day: day.day,
        weekday: day.weekday,
        isCurrentMonth: day.isCurrentMonth !== false,
        isToday: day.date === today,
        isSelected: day.date === selectedDate,
        isMarked: markedDates.has(day.date)
      };
    });
  },

  /**
   * 加载指定日期的事件列表（计划 + 记录）
   * @param {string} date - YYYY-MM-DD
   */
  _loadDayEvents: function (date) {
    var self = this;
    var events = [];

    // 过滤该日期的计划
    var dayPlans = (this._allPlans || []).filter(function (p) {
      return p.plan_date === date;
    });

    // 过滤该日期的记录
    var dayRecords = (this._allRecords || []).filter(function (r) {
      return r.visit_date === date;
    });

    var today = dateUtil.today();

    // 构建计划事件
    dayPlans.forEach(function (plan) {
      var customer = self._customerMap[plan.customer_id];
      if (!customer) return;

      var status = 'pending';
      if (plan.status === constants.PLAN_STATUS.COMPLETED) {
        status = 'completed';
      } else if (plan.plan_date < today) {
        status = 'overdue';
      }

      events.push({
        id: 'plan_' + plan.id,
        type: 'plan',
        planId: plan.id,
        customerId: plan.customer_id,
        time: plan.plan_time || '全天',
        customerName: customer.name,
        stage: customer.stage,
        stageClass: constants.STAGE_CLASS_MAP[customer.stage] || '',
        visitWay: plan.visit_way,
        status: status,
        statusText: status === 'completed' ? '已完成' : (status === 'overdue' ? '逾期' : '待执行'),
        statusColor: status === 'completed' ? '#10B981' : (status === 'overdue' ? '#EF4444' : '#2563EB')
      });
    });

    // 构建记录事件
    dayRecords.forEach(function (record) {
      var customer = self._customerMap[record.customer_id];
      if (!customer) return;

      var status = record.record_type === 'adhoc' ? 'adhoc' : 'completed';

      events.push({
        id: 'record_' + record.id,
        type: 'record',
        recordId: record.id,
        customerId: record.customer_id,
        time: record.visit_time || '全天',
        customerName: customer.name,
        stage: customer.stage,
        stageClass: constants.STAGE_CLASS_MAP[customer.stage] || '',
        visitWay: record.visit_way,
        status: status,
        statusText: status === 'adhoc' ? '临时' : '已完成',
        statusColor: status === 'adhoc' ? '#64748B' : '#10B981'
      });
    });

    // 按时间排序
    events.sort(function (a, b) {
      var timeA = a.time === '全天' ? '24:00' : a.time;
      var timeB = b.time === '全天' ? '24:00' : b.time;
      return timeA.localeCompare(timeB);
    });

    this.setData({ events: events });
  },

  /**
   * 切换视图模式
   */
  onToggleView: function (e) {
    var mode = e.currentTarget.dataset.mode;
    if (mode === this.data.viewMode) return;

    this.setData({ viewMode: mode });
    this._refreshCalendarView();
  },

  /**
   * 前翻页
   */
  onPrevPage: function () {
    var anchorDate = this.data.anchorDate;
    var viewMode = this.data.viewMode;
    var newAnchor = viewMode === 'week'
      ? dateUtil.shiftWeek(anchorDate, -1)
      : dateUtil.shiftMonth(anchorDate, -1);

    this.setData({ anchorDate: newAnchor });
    this._refreshCalendarView();
  },

  /**
   * 后翻页
   */
  onNextPage: function () {
    var anchorDate = this.data.anchorDate;
    var viewMode = this.data.viewMode;
    var newAnchor = viewMode === 'week'
      ? dateUtil.shiftWeek(anchorDate, 1)
      : dateUtil.shiftMonth(anchorDate, 1);

    this.setData({ anchorDate: newAnchor });
    this._refreshCalendarView();
  },

  /**
   * 点击日期
   */
  onDateTap: function (e) {
    var date = e.currentTarget.dataset.date;
    this.setData({ selectedDate: date });
    this._refreshCalendarView();
    this._loadDayEvents(date);
  },

  /**
   * 点击事件条目
   */
  onEventTap: function (e) {
    var eventId = e.currentTarget.dataset.eventId;
    var event = this.data.events.find(function (ev) {
      return ev.id === eventId;
    });

    if (!event) return;

    if (event.type === 'plan') {
      // 跳转到客户详情，在那里可以执行或编辑计划
      wx.navigateTo({
        url: '/pages/customer-detail/index?id=' + event.customerId
      });
    } else if (event.type === 'record') {
      // 跳转到拜访记录详情
      wx.navigateTo({
        url: '/pages/visit-record/detail/index?id=' + event.recordId
      });
    }
  }
});

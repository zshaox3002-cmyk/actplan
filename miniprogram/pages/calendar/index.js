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

/**
 * 安全解码 URL 编码的字符串，解码失败时返回原值
 * @param {string} str
 * @returns {string}
 */
function safeDecodeURIComponent(str) {
  if (!str) return str;
  try {
    return decodeURIComponent(str);
  } catch (e) {
    return str;
  }
}

Page({
  data: {
    anchorDate: '',             // 当前锚点日期
    selectedDate: '',           // 选中的日期
    yearMonth: '',              // 年月显示（YYYY-MM）
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
    // selectedDate 未初始化时说明 onLoad 的异步回调还没执行，跳过
    if (!this.data.selectedDate) return;
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
    var allCustomers = customerRepo.list();  // 不传参数获取全量客户

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
   * 根据 anchorDate 刷新月视图
   */
  _refreshCalendarView: function () {
    var anchorDate = this.data.anchorDate;
    var yearMonth = anchorDate.substring(0, 7);
    var monthDays = dateUtil.getMonthDays(anchorDate);
    monthDays = this._buildDaysWithMarks(monthDays);
    this.setData({ monthDays: monthDays, yearMonth: yearMonth });
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
      var dateStr = day.date || '';
      var dayNum = dateStr.substring(5);  // 提取 MM-DD

      return {
        date: day.date,
        dayNum: dayNum,  // 预计算的日期数字
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

    // 已完成计划若有对应记录，只显示记录，不重复显示计划
    var recordPlanIds = {};
    dayRecords.forEach(function (r) {
      if (r.plan_id !== null && r.plan_id !== undefined) {
        recordPlanIds[r.plan_id] = true;
      }
    });

    var today = dateUtil.today();

    // 构建计划事件（跳过已有对应记录的已完成计划）
    dayPlans.forEach(function (plan) {
      if (recordPlanIds[plan.id]) return;

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
        time: plan.plan_time || '-',
        customerName: customer.name,
        stage: customer.stage,
        stageClass: constants.STAGE_CLASS_MAP[customer.stage] || '',
        visitWay: safeDecodeURIComponent(plan.visit_way) || '',
        goal: plan.goal || '',
        status: status,
        statusText: status === 'completed' ? '已完成' : (status === 'overdue' ? '逾期' : '待执行'),
        statusColor: status === 'completed' ? '#10B981' : (status === 'overdue' ? '#EF4444' : '#2563EB')
      });
    });

    // 构建记录事件
    dayRecords.forEach(function (record) {
      var customer = self._customerMap[record.customer_id];
      if (!customer) return;

      var isAdhoc = record.record_type === 'adhoc';
      var status = isAdhoc ? 'adhoc' : 'completed';

      events.push({
        id: 'record_' + record.id,
        type: 'record',
        recordId: record.id,
        customerId: record.customer_id,
        time: record.visit_time || '-',
        customerName: customer.name,
        stage: customer.stage,
        stageClass: constants.STAGE_CLASS_MAP[customer.stage] || '',
        visitWay: safeDecodeURIComponent(record.visit_way) || '',
        status: status,
        statusText: isAdhoc ? '随手记' : '已完成',
        statusColor: isAdhoc ? '#64748B' : '#10B981'
      });
    });

    // 按时间排序（无时间的排最后）
    events.sort(function (a, b) {
      var timeA = a.time === '-' ? '99:99' : a.time;
      var timeB = b.time === '-' ? '99:99' : b.time;
      return timeA.localeCompare(timeB);
    });

    this.setData({ events: events });
  },

  /**
   * 前翻一个月
   */
  onPrevPage: function () {
    var newAnchor = dateUtil.shiftMonth(this.data.anchorDate, -1);
    var self = this;
    this.setData({ anchorDate: newAnchor }, function () {
      self._loadData();
    });
  },

  /**
   * 后翻一个月
   */
  onNextPage: function () {
    var newAnchor = dateUtil.shiftMonth(this.data.anchorDate, 1);
    var self = this;
    this.setData({ anchorDate: newAnchor }, function () {
      self._loadData();
    });
  },

  /**
   * 点击日期
   */
  onDateTap: function (e) {
    var date = e.currentTarget.dataset.date;
    var self = this;
    this.setData({ selectedDate: date }, function () {
      self._loadData();
    });
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
      // 跳转到客户详情计划 tab，在那里可以执行或编辑计划
      wx.navigateTo({
        url: '/pages/customer-detail/index?id=' + event.customerId + '&tab=plan'
      });
    } else if (event.type === 'record') {
      // 跳转到拜访记录详情
      wx.navigateTo({
        url: '/pages/visit-record/detail/index?id=' + event.recordId
      });
    }
  }
});

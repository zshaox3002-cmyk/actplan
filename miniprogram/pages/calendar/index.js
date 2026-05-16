/**
 * calendar/index.js — 日历看板（预约管理主入口）
 * 支持三类事件卡片：未完成预约 / 已完成预约 / 随手记
 * 支持新建预约、编辑计划、删除事件
 */

var storage = require('../../utils/storage');
var planRepo = require('../../utils/repository/plan.repo');
var recordRepo = require('../../utils/repository/record.repo');
var customerRepo = require('../../utils/repository/customer.repo');
var dateUtil = require('../../utils/date');
var constants = require('../../utils/constants');

/**
 * 安全解码 URL 编码的字符串
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
    anchorDate: '',
    selectedDate: '',
    yearMonth: '',
    monthDays: [],
    events: [],
    loading: true,
    listPaddingBottom: '280rpx',

    // 新建预约弹窗
    showCreateSheet: false,
    createDate: '',
    createTime: '',
    createVisitWay: '面对面',
    createGoal: '',
    createCustomerId: null,
    createCustomerName: '',
    createSearchKeyword: '',
    createSearchResults: [],
    showCustomerSearch: false,
    conflictTip: '',
    isSaving: false,

    // 编辑计划弹窗
    showEditPlanSheet: false,
    editPlanId: null,
    editPlanDate: '',
    editPlanTime: '',
    editPlanVisitWay: '面对面',
    editPlanGoal: '',
    editPlanCustomerName: '',
    isEditSaving: false,

    // 编辑沟通摘要 sheet
    showRecordEditSheet: false,
    recordEditId: null,
    recordEditSummary: '',
    isRecordSaving: false,

    visitWayOptions: ['面对面', '电话', '微信']
  },

  onLoad: function () {
    var info = wx.getSystemInfoSync();
    // tabBar 约 50px + FAB 50px + 安全区底部，统一转为 rpx（750rpx / screenWidth）
    var ratio = 750 / info.screenWidth;
    var bottomPad = Math.ceil((info.screenHeight - info.safeArea.bottom + 50 + 60) * ratio);
    this.setData({ listPaddingBottom: bottomPad + 'rpx' });

    storage.waitReady().then(() => {
      this._initCalendar();
    });
  },

  onShow: function () {
    if (!this.data.selectedDate) return;
    this._loadData();
  },

  /**
   * 初始化日历：设置锚点为今天
   */
  _initCalendar: function () {
    var today = dateUtil.today();
    var self = this;
    this.setData({ anchorDate: today, selectedDate: today }, function () {
      self._loadData();
    });
  },

  /**
   * 加载全量数据，刷新月视图和当日事件
   */
  _loadData: function () {
    var allPlans = planRepo.listAll();
    var allRecords = recordRepo.list();
    var allCustomers = customerRepo.list();

    var customerMap = {};
    allCustomers.forEach(function (c) { customerMap[c.id] = c; });

    var markedDates = new Set();
    allPlans.forEach(function (p) { markedDates.add(p.plan_date); });
    allRecords.forEach(function (r) { markedDates.add(r.visit_date); });

    this._allPlans = allPlans;
    this._allRecords = allRecords;
    this._allCustomers = allCustomers;
    this._customerMap = customerMap;
    this._markedDates = markedDates;

    this.setData({ loading: false });
    this._refreshCalendarView();
    this._loadDayEvents(this.data.selectedDate);
  },

  /**
   * 刷新月视图
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
      return {
        date: day.date,
        dayNum: dateStr.substring(5),
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
   * 加载指定日期的三类事件
   * @param {string} date - YYYY-MM-DD
   */
  _loadDayEvents: function (date) {
    var self = this;
    var events = [];
    var today = dateUtil.today();

    var dayPlans = (this._allPlans || []).filter(function (p) { return p.plan_date === date; });
    var dayRecords = (this._allRecords || []).filter(function (r) { return r.visit_date === date; });

    // 构建 plan_id → record 映射（已完成预约对应的记录）
    var planIdToRecord = {};
    dayRecords.forEach(function (r) {
      if (r.plan_id !== null && r.plan_id !== undefined) {
        planIdToRecord[r.plan_id] = r;
      }
    });

    // 1. 处理计划：pending_plan 或 completed_plan
    dayPlans.forEach(function (plan) {
      var customer = self._customerMap[plan.customer_id];
      if (!customer) return;

      var linkedRecord = planIdToRecord[plan.id];

      if (plan.status === constants.PLAN_STATUS.COMPLETED && linkedRecord) {
        // 已完成预约（有关联记录）
        events.push({
          id: 'plan_' + plan.id,
          cardType: 'completed_plan',
          planId: plan.id,
          recordId: linkedRecord.id,
          customerId: plan.customer_id,
          time: linkedRecord.visit_time || plan.plan_time || '-',
          customerName: customer.name,
          stage: customer.stage,
          stageClass: constants.STAGE_CLASS_MAP[customer.stage] || '',
          visitWayLabel: safeDecodeURIComponent(linkedRecord.visit_way) || '面对面',
          summary: linkedRecord.summary || ''
        });
      } else if (plan.status === constants.PLAN_STATUS.PENDING) {
        // 未完成预约
        var isOverdue = plan.plan_date < today;
        events.push({
          id: 'plan_pending_' + plan.id,
          cardType: 'pending_plan',
          planId: plan.id,
          recordId: null,
          customerId: plan.customer_id,
          time: plan.plan_time || '-',
          customerName: customer.name,
          stage: customer.stage,
          stageClass: constants.STAGE_CLASS_MAP[customer.stage] || '',
          visitWayLabel: safeDecodeURIComponent(plan.visit_way) || '面对面',
          goal: plan.goal || '',
          isOverdue: isOverdue
        });
      }
      // 已完成但无关联记录的计划：视为 pending（异常状态），也展示为 pending
      else if (plan.status === constants.PLAN_STATUS.COMPLETED && !linkedRecord) {
        events.push({
          id: 'plan_pending_' + plan.id,
          cardType: 'pending_plan',
          planId: plan.id,
          recordId: null,
          customerId: plan.customer_id,
          time: plan.plan_time || '-',
          customerName: customer.name,
          stage: customer.stage,
          stageClass: constants.STAGE_CLASS_MAP[customer.stage] || '',
          visitWayLabel: safeDecodeURIComponent(plan.visit_way) || '面对面',
          goal: plan.goal || '',
          isOverdue: false
        });
      }
    });

    // 2. 处理随手记（adhoc）
    dayRecords.forEach(function (record) {
      if (record.record_type !== 'adhoc') return;
      var customer = self._customerMap[record.customer_id];
      if (!customer) return;

      events.push({
        id: 'record_' + record.id,
        cardType: 'adhoc_record',
        planId: null,
        recordId: record.id,
        customerId: record.customer_id,
        time: record.visit_time || '-',
        customerName: customer.name,
        stage: customer.stage,
        stageClass: constants.STAGE_CLASS_MAP[customer.stage] || '',
        visitWayLabel: '随记',
        summary: record.summary || ''
      });
    });

    // 按时间升序（无时间排最后）
    events.sort(function (a, b) {
      var timeA = a.time === '-' ? '99:99' : a.time;
      var timeB = b.time === '-' ? '99:99' : b.time;
      return timeA.localeCompare(timeB);
    });

    this.setData({ events: events });
  },

  // ─── 月历导航 ───────────────────────────────────────────────

  onPrevPage: function () {
    var newAnchor = dateUtil.shiftMonth(this.data.anchorDate, -1);
    var self = this;
    this.setData({ anchorDate: newAnchor }, function () { self._loadData(); });
  },

  onNextPage: function () {
    var newAnchor = dateUtil.shiftMonth(this.data.anchorDate, 1);
    var self = this;
    this.setData({ anchorDate: newAnchor }, function () { self._loadData(); });
  },

  onDateTap: function (e) {
    var date = e.currentTarget.dataset.date;
    var self = this;
    this.setData({ selectedDate: date }, function () { self._loadData(); });
  },

  // ─── 事件操作 ───────────────────────────────────────────────

  /**
   * 点击"记录"按钮：跳转新建记录页，携带计划信息
   */
  onRecordPlan: function (e) {
    var planId = parseInt(e.currentTarget.dataset.planId);
    var event = this._findEventByPlanId(planId);
    if (!event) return;

    var plan = planRepo.get(planId);
    if (!plan) return;

    var url = '/pages/record-new/index' +
      '?record_type=planned' +
      '&customer_id=' + event.customerId +
      '&plan_id=' + planId +
      '&plan_date=' + plan.plan_date +
      '&plan_time=' + (plan.plan_time || '') +
      '&visit_way=' + encodeURIComponent(plan.visit_way || '面对面') +
      '&plan_goal=' + encodeURIComponent(plan.goal || '') +
      '&customer_name=' + encodeURIComponent(event.customerName);

    wx.navigateTo({ url: url });
  },

  /**
   * 点击"编辑"按钮（未完成预约）：弹出编辑计划 sheet
   */
  onEditPlan: function (e) {
    var planId = parseInt(e.currentTarget.dataset.planId);
    var plan = planRepo.get(planId);
    if (!plan) return;

    var customer = this._customerMap[plan.customer_id];

    this.setData({
      showEditPlanSheet: true,
      editPlanId: planId,
      editPlanDate: plan.plan_date,
      editPlanTime: plan.plan_time || '',
      editPlanVisitWay: safeDecodeURIComponent(plan.visit_way) || '面对面',
      editPlanGoal: plan.goal || '',
      editPlanCustomerName: customer ? customer.name : ''
    });
  },

  /**
   * 点击"编辑"按钮（已完成/随手记）：弹出编辑沟通摘要 sheet
   */
  onEditRecord: function (e) {
    var recordId = parseInt(e.currentTarget.dataset.recordId);
    var record = recordRepo.get(recordId);
    if (!record) return;
    this.setData({
      showRecordEditSheet: true,
      recordEditId: recordId,
      recordEditSummary: record.summary || ''
    });
  },

  onRecordEditSummaryInput: function (e) {
    this.setData({ recordEditSummary: e.detail.value });
  },

  onRecordEditCancel: function () {
    this.setData({ showRecordEditSheet: false, recordEditId: null, recordEditSummary: '' });
  },

  /**
   * 保存沟通摘要编辑
   */
  onRecordEditConfirm: function () {
    if (this.data.isRecordSaving) return;
    this.setData({ isRecordSaving: true });
    try {
      recordRepo.update(this.data.recordEditId, { summary: this.data.recordEditSummary });
      var editId = this.data.recordEditId;
      var editSummary = this.data.recordEditSummary;
      var newEvents = this.data.events.map(function (ev) {
        return ev.recordId === editId
          ? Object.assign({}, ev, { summary: editSummary })
          : ev;
      });
      this.setData({
        events: newEvents,
        showRecordEditSheet: false,
        recordEditId: null,
        recordEditSummary: ''
      });
      wx.showToast({ title: '已保存', icon: 'success' });
    } catch (err) {
      wx.showToast({ title: '保存失败', icon: 'none' });
    } finally {
      this.setData({ isRecordSaving: false });
    }
  },

  /**
   * 删除事件（三类文案不同）
   */
  onDeleteEvent: function (e) {
    var cardType = e.currentTarget.dataset.cardType;
    var planId = e.currentTarget.dataset.planId ? parseInt(e.currentTarget.dataset.planId) : null;
    var recordId = e.currentTarget.dataset.recordId ? parseInt(e.currentTarget.dataset.recordId) : null;
    var self = this;

    var contentMap = {
      pending_plan: '删除后该预约将无法恢复。',
      completed_plan: '删除后仅移除这条沟通记录，不会自动恢复原预约状态。',
      adhoc_record: '删除后这条随手记将无法恢复。'
    };

    wx.showModal({
      title: '确认删除',
      content: contentMap[cardType] || '确认删除？',
      confirmText: '删除',
      confirmColor: '#EF4444',
      success: function (res) {
        if (!res.confirm) return;
        try {
          if (cardType === 'pending_plan') {
            planRepo.delete(planId);
          } else {
            recordRepo.remove(recordId);
          }
          self._loadData();
        } catch (err) {
          wx.showToast({ title: '删除失败', icon: 'none' });
        }
      }
    });
  },

  // ─── 新建预约弹窗 ────────────────────────────────────────────

  onOpenCreateSheet: function () {
    this.setData({
      showCreateSheet: true,
      createDate: this.data.selectedDate,
      createTime: '',
      createVisitWay: '面对面',
      createGoal: '',
      createCustomerId: null,
      createCustomerName: '',
      createSearchKeyword: '',
      createSearchResults: [],
      showCustomerSearch: false,
      conflictTip: ''
    });
  },

  onCloseCreateSheet: function () {
    this.setData({ showCreateSheet: false });
  },

  onCreateSearchInput: function (e) {
    var keyword = e.detail.value || '';
    this.setData({ createSearchKeyword: keyword });

    if (!keyword.trim()) {
      this.setData({ createSearchResults: [], showCustomerSearch: false });
      return;
    }

    var kw = keyword.trim().toLowerCase();
    var results = (this._allCustomers || []).filter(function (c) {
      return c.name && c.name.toLowerCase().indexOf(kw) >= 0;
    }).slice(0, 10).map(function (c) {
      return { id: c.id, name: c.name, stage: c.stage || '' };
    });

    this.setData({ createSearchResults: results, showCustomerSearch: results.length > 0 });
  },

  onCreateCustomerSelect: function (e) {
    var customerId = parseInt(e.currentTarget.dataset.id);
    var customerName = e.currentTarget.dataset.name;

    // 检查是否已有未来待执行计划（轻提示）
    var hasFuturePlan = (this._allPlans || []).some(function (p) {
      return p.customer_id === customerId && p.status === constants.PLAN_STATUS.PENDING;
    });

    this.setData({
      createCustomerId: customerId,
      createCustomerName: customerName,
      createSearchKeyword: customerName,
      createSearchResults: [],
      showCustomerSearch: false,
      conflictTip: hasFuturePlan ? '该客户已有未来预约，请确认是否继续新增。' : ''
    });
  },

  onCreateDateChange: function (e) {
    this.setData({ createDate: e.detail.value });
  },

  onCreateTimeChange: function (e) {
    this.setData({ createTime: e.detail.value });
  },

  onCreateClearTime: function () {
    this.setData({ createTime: '' });
  },

  onCreateVisitWayTap: function (e) {
    this.setData({ createVisitWay: e.currentTarget.dataset.way });
  },

  onCreateGoalInput: function (e) {
    this.setData({ createGoal: e.detail.value });
  },

  /**
   * 确认新建预约
   */
  onCreateConfirm: function () {
    if (this.data.isSaving) return;

    var d = this.data;
    if (!d.createCustomerId) {
      wx.showToast({ title: '请选择客户', icon: 'none' });
      return;
    }
    if (!d.createDate) {
      wx.showToast({ title: '请选择日期', icon: 'none' });
      return;
    }

    this.setData({ isSaving: true });

    var result = planRepo.create({
      customer_id: d.createCustomerId,
      plan_date: d.createDate,
      plan_time: d.createTime || null,
      visit_way: d.createVisitWay,
      goal: d.createGoal || '',
      status: constants.PLAN_STATUS.PENDING
    });

    this.setData({ isSaving: false });

    if (result && result.conflict) {
      wx.showToast({ title: '该客户当日已有预约', icon: 'none' });
      return;
    }

    this.setData({ showCreateSheet: false });

    // 若新建日期与当前选中日期一致则直接刷新，否则跳到新建日期
    var self = this;
    if (d.createDate !== this.data.selectedDate) {
      this.setData({ selectedDate: d.createDate, anchorDate: d.createDate }, function () {
        self._loadData();
      });
    } else {
      this._loadData();
    }
  },

  // ─── 编辑计划弹窗 ────────────────────────────────────────────

  onCloseEditPlanSheet: function () {
    this.setData({ showEditPlanSheet: false });
  },

  onEditPlanDateChange: function (e) {
    this.setData({ editPlanDate: e.detail.value });
  },

  onEditPlanTimeChange: function (e) {
    this.setData({ editPlanTime: e.detail.value });
  },

  onEditPlanClearTime: function () {
    this.setData({ editPlanTime: '' });
  },

  onEditPlanVisitWayTap: function (e) {
    this.setData({ editPlanVisitWay: e.currentTarget.dataset.way });
  },

  onEditPlanGoalInput: function (e) {
    this.setData({ editPlanGoal: e.detail.value });
  },

  onEditPlanConfirm: function () {
    if (this.data.isEditSaving) return;

    var d = this.data;
    if (!d.editPlanDate) {
      wx.showToast({ title: '请选择日期', icon: 'none' });
      return;
    }

    this.setData({ isEditSaving: true });

    planRepo.update(d.editPlanId, {
      plan_date: d.editPlanDate,
      plan_time: d.editPlanTime || null,
      visit_way: d.editPlanVisitWay,
      goal: d.editPlanGoal
    });

    this.setData({ isEditSaving: false, showEditPlanSheet: false });

    var self = this;
    // 如果日期改变了，切换到新日期
    if (d.editPlanDate !== this.data.selectedDate) {
      this.setData({ selectedDate: d.editPlanDate, anchorDate: d.editPlanDate }, function () {
        self._loadData();
      });
    } else {
      this._loadData();
    }
  },

  // ─── 工具方法 ─────────────────────────────────────────────────

  /**
   * 根据 planId 在 events 中查找事件
   * @param {number} planId
   * @returns {Object|null}
   */
  _findEventByPlanId: function (planId) {
    var pid = parseInt(planId);
    return this.data.events.find(function (ev) {
      return ev.planId === pid;
    }) || null;
  }
});

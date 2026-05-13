/**
 * dashboard/index.js — 行动面板
 *
 * 布局：
 * - 顶部问候语
 * - KPI 三格：逾期未做 / 待执行计划 / 本月签单
 * - 今日要做任务列表
 * - 客户阶段漏斗
 */

var stats = require('../../utils/stats');
var planRepo = require('../../utils/repository/plan.repo');
var policyRepo = require('../../utils/repository/policy.repo');
var dateUtil = require('../../utils/date');
var storage = require('../../utils/storage');
var reviewStats = require('../../utils/review-stats');
var taskDismissRepo = require('../../utils/repository/task_dismiss.repo');
var toast = require('../../utils/toast');
var Toast = require('@vant/weapp/toast/toast');

Page({
  data: {
    // 问候语
    greetingPrefix: '',
    greetingSubtext: '',
    greetingWarn: false,

    // KPI 三格
    kpiOverdue: 0,
    kpiPending: 0,
    kpiMonthDeal: 0,

    // 今日要做
    todayTasks: [],
    taskTotal: 0,
    taskEmptyType: '',

    // 拜访计划底部 sheet（add = 新建，edit = 修改）
    showPlanSheet: false,
    planSheetMode: 'add',
    planSheetPlanId: null,
    planSheetCustomerId: null,
    planSheetCustomerName: '',
    planSheetDate: '',
    planSheetTime: '',
    planSheetVisitWay: '面对面',
    planSheetGoal: '',
    visitWayOptions: ['面对面', '电话', '微信'],
    isSaving: false
  },

  onLoad: function () {
    this._safeRefresh();
  },

  onShow: function () {
    this._safeRefresh();
  },

  _safeRefresh: function () {
    var that = this;
    if (storage.isReady()) {
      that._refresh();
    } else {
      storage.waitReady().then(function () { that._refresh(); });
    }
  },

  _refresh: function () {
    try {
      var now = new Date();
      var today = dateUtil.today();

      var snapshot = stats.getStatsSnapshot();
      snapshot.objection_note = storage.getTable('objection_note');

      // KPI：逾期未做 / 待执行计划
      var kpiOverdue = 0;
      var kpiPending = 0;
      for (var i = 0; i < snapshot.plan.length; i++) {
        var p = snapshot.plan[i];
        if (p.status !== '待执行') continue;
        if (p.plan_date && p.plan_date < today) {
          kpiOverdue++;
        } else {
          kpiPending++;
        }
      }

      // KPI：本月签单（保单数量，按 effective_date 统计）
      var monthRange = dateUtil.getMonthRange();
      var allPolicies = policyRepo.listAll();
      var kpiMonthDeal = 0;
      for (var j = 0; j < allPolicies.length; j++) {
        var pol = allPolicies[j];
        var polDate = (pol.effective_date || '').substring(0, 10);
        if (polDate >= monthRange[0] && polDate <= monthRange[1]) kpiMonthDeal++;
      }

      // 今日要做
      var dismissedSet = taskDismissRepo.getDismissedSetForDate(today);
      var taskResult = reviewStats.getTodayTasks(snapshot, today, dismissedSet);

      // 问候语
      var hour = now.getHours();
      var greetingPrefix = hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好';
      var greetingSubtext = '';
      var greetingWarn = false;
      if (taskResult.total > 0) {
        greetingSubtext = '今天有 ' + taskResult.total + ' 件事要处理';
        greetingWarn = kpiOverdue > 0;
      } else {
        greetingSubtext = '今天没有待办，保持节奏';
      }

      this.setData({
        greetingPrefix: greetingPrefix,
        greetingSubtext: greetingSubtext,
        greetingWarn: greetingWarn,
        kpiOverdue: kpiOverdue,
        kpiPending: kpiPending,
        kpiMonthDeal: kpiMonthDeal,
        todayTasks: taskResult.list,
        taskTotal: taskResult.total,
        taskEmptyType: taskResult.empty_type
      });
    } catch (e) {
      Toast.fail('数据加载失败');
      console.error('[Dashboard] _refresh error:', e);
    }
  },

  /** 任务卡片操作按钮统一入口 */
  onTaskAction: function (e) {
    var action = e.currentTarget.dataset.action;
    var taskId = e.currentTarget.dataset.taskId;
    var task = null;
    for (var i = 0; i < this.data.todayTasks.length; i++) {
      if (this.data.todayTasks[i].task_id === taskId) {
        task = this.data.todayTasks[i];
        break;
      }
    }
    if (!task) return;

    if (action === '执行') this._handleExecute(task);
    else if (action === '修改') this._handleModify(task);
    else if (action === '删除') this._handleDelete(task);
    else if (action === '预约') this._handleBook(task);
    else if (action === '随手记') this._handleQuickNote(task);
    else if (action === '查看异议') this._handleViewObjection(task);
    else if (action === '暂不处理') this._handleDismiss(task);
  },

  _handleExecute: function (task) {
    wx.navigateTo({
      url: '/pages/record-new/index?customer_id=' + task.customer_id +
           '&plan_id=' + task.plan_id +
           '&record_type=planned' +
           '&customer_name=' + encodeURIComponent(task.customer_name) +
           '&plan_date=' + (task.plan_date || '') +
           '&plan_time=' + (task.plan_time || '') +
           '&visit_way=' + encodeURIComponent(task.visit_way || '面对面') +
           '&plan_goal=' + encodeURIComponent(task.plan_goal || '')
    });
  },

  _handleModify: function (task) {
    var plan = planRepo.get(task.plan_id);
    if (!plan) return;
    this.setData({
      showPlanSheet: true,
      planSheetMode: 'edit',
      planSheetPlanId: task.plan_id,
      planSheetCustomerId: task.customer_id,
      planSheetCustomerName: task.customer_name,
      planSheetDate: plan.plan_date,
      planSheetTime: plan.plan_time || '',
      planSheetVisitWay: plan.visit_way || '面对面',
      planSheetGoal: plan.goal || ''
    });
  },

  _handleDelete: function (task) {
    var that = this;
    wx.showModal({
      title: '删除计划',
      content: '确认删除这条计划？',
      confirmColor: '#EF4444',
      success: function (res) {
        if (!res.confirm) return;
        planRepo['delete'](task.plan_id);
        that._refresh();
      }
    });
  },

  _handleBook: function (task) {
    this.setData({
      showPlanSheet: true,
      planSheetMode: 'add',
      planSheetPlanId: null,
      planSheetCustomerName: task.customer_name,
      planSheetCustomerId: task.customer_id,
      planSheetDate: dateUtil.today(),
      planSheetTime: '',
      planSheetVisitWay: '面对面',
      planSheetGoal: ''
    });
  },

  _handleQuickNote: function (task) {
    wx.navigateTo({
      url: '/pages/record-new/index?customer_id=' + task.customer_id + '&mode=quick_note'
    });
  },

  _handleViewObjection: function (task) {
    wx.navigateTo({
      url: '/pages/customer-detail/index?id=' + task.customer_id + '&tab=objection'
    });
  },

  _handleDismiss: function (task) {
    var today = dateUtil.today();
    taskDismissRepo.dismiss(task.customer_id, task.task_type, today);
    this._refresh();
  },

  onGoAddCustomer: function () {
    wx.switchTab({ url: '/pages/customer/index' });
  },

  onGoAddPlan: function () {
    wx.switchTab({ url: '/pages/customer/index' });
  },

  onGoNeedAttention: function () {
    wx.switchTab({ url: '/pages/customer/index' });
  },

  // ---- Plan Sheet 事件处理器 ----

  onPlanSheetDateChange: function (e) {
    this.setData({ planSheetDate: e.detail.value });
  },

  onPlanSheetTimeChange: function (e) {
    this.setData({ planSheetTime: e.detail.value });
  },

  onPlanSheetWayChange: function (e) {
    this.setData({ planSheetVisitWay: e.currentTarget.dataset.way });
  },

  onPlanSheetGoalInput: function (e) {
    this.setData({ planSheetGoal: e.detail.value });
  },

  onPlanSheetCancel: function () {
    this.setData({ showPlanSheet: false });
  },

  onPlanSheetConfirm: function () {
    if (this.data.isSaving) return;
    this.setData({ isSaving: true });

    if (this.data.planSheetMode === 'add') {
      var result = planRepo.create({
        customer_id: this.data.planSheetCustomerId,
        plan_date: this.data.planSheetDate,
        plan_time: this.data.planSheetTime || null,
        visit_way: this.data.planSheetVisitWay,
        goal: this.data.planSheetGoal || ''
      });
      if (result.conflict) {
        toast.fail('该客户当日已有计划');
        this.setData({ isSaving: false });
        return;
      }
    } else {
      planRepo.update(this.data.planSheetPlanId, {
        plan_date: this.data.planSheetDate,
        plan_time: this.data.planSheetTime || null,
        visit_way: this.data.planSheetVisitWay,
        goal: this.data.planSheetGoal
      });
    }

    this.setData({ showPlanSheet: false, isSaving: false });
    this._refresh();
  }
});

/**
 * dashboard/index.js — 行动面板
 *
 * 布局：
 * - 顶部问候语 + 周期选择
 * - 逾期警示条
 * - 今日拜访列表
 * - 本周进展指标卡
 * - 客户阶段漏斗
 * - 待跟进客户 Top
 */

var stats = require('../../utils/stats');
var planRepo = require('../../utils/repository/plan.repo');
var customerRepo = require('../../utils/repository/customer.repo');
var dateUtil = require('../../utils/date');
var storage = require('../../utils/storage');
var Toast = require('@vant/weapp/toast/toast');

var PERIOD_CONFIG = {
  week:    { label: '本周', rangeFn: dateUtil.getWeekRange },
  month:   { label: '本月', rangeFn: dateUtil.getMonthRange },
  quarter: { label: '季度', rangeFn: dateUtil.getQuarterRange },
  year:    { label: '年度', rangeFn: dateUtil.getYearRange }
};

Page({
  data: {
    currentPeriod: 'week',
    periodLabel: '本周',
    periodRange: '',
    showPeriodDropdown: false,

    // 问候语
    greetingPrefix: '',
    greetingSubtext: '',
    greetingWarn: false,

    // 逾期
    overdueCount: 0,

    // 今日拜访
    todayPlans: [],

    // 本周进展指标
    metrics: { newCustomers: 0, visitCount: 0, appointmentCount: 0, dealCustomers: 0 },

    // 客户阶段漏斗
    stageFunnel: [],
    funnelMax: 1,   // 用于计算进度条宽度比例

    // 待跟进 Top
    pendingFollowUp: [],

    isEmpty: false
  },

  onLoad: function () {
    this._updatePeriodDisplay();
    this._safeRefresh();
  },

  onShow: function () {
    this._updatePeriodDisplay();
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

  _updatePeriodDisplay: function () {
    var period = this.data.currentPeriod;
    var config = PERIOD_CONFIG[period];
    var range = config.rangeFn();
    var startParts = range[0].split('-');
    var endParts = range[1].split('-');
    var periodRange = parseInt(startParts[1]) + '.' + parseInt(startParts[2]) +
      ' - ' + parseInt(endParts[1]) + '.' + parseInt(endParts[2]);
    if (period === 'year') periodRange = startParts[0] + '年';

    this.setData({ periodLabel: config.label, periodRange: periodRange });
  },

  _refresh: function () {
    try {
      var now = new Date();
      var todayStr = now.getFullYear() + '-' +
        String(now.getMonth() + 1).padStart(2, '0') + '-' +
        String(now.getDate()).padStart(2, '0');

      var snapshot = stats.getStatsSnapshot();
      var period = this.data.currentPeriod;

      // 指标
      var metrics = stats.getDashboardMetrics(snapshot, period);

      // 今日拜访（今天的待执行计划）
      var todayPlans = planRepo.list(todayStr).filter(function (p) {
        return p.status === '待执行';
      });
      // 补充客户名
      todayPlans = todayPlans.map(function (p) {
        var c = customerRepo.get(p.customer_id);
        return Object.assign({}, p, { customerName: c ? c.name : '', customerStage: c ? c.stage : '' });
      });

      // 逾期计划
      var allPlans = planRepo.listAll();
      var overdueCount = 0;
      for (var i = 0; i < allPlans.length; i++) {
        if (allPlans[i].status === '待执行' && allPlans[i].plan_date < todayStr) overdueCount++;
      }

      // 问候语
      var hour = now.getHours();
      var greetingPrefix = hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好';

      // 阶段漏斗
      var stageFunnel = stats.getStageFunnel(snapshot);
      var funnelMax = 1;
      for (var j = 0; j < stageFunnel.length; j++) {
        if (stageFunnel[j].count > funnelMax) funnelMax = stageFunnel[j].count;
      }

      // 待跟进 Top 3
      var STAGE_CLASS_MAP = {
        '初步认识': 'meet',
        '需求沟通': 'comm',
        '方案讲解': 'present',
        '待促成':   'closing',
        '已成交':   'deal',
        '已流失':   'lost'
      };
      var pendingList = stats.getPendingFollowUp(snapshot, 3);
      var pendingFollowUp = pendingList.map(function (item) {
        var nextPlanText = '';
        if (item.nextPlan) {
          if (item.nextPlan.plan_date < todayStr) {
            var diff = Math.round((new Date(todayStr) - new Date(item.nextPlan.plan_date)) / 86400000);
            nextPlanText = '计划已逾期 ' + diff + ' 天';
          } else if (item.nextPlan.plan_date === todayStr) {
            nextPlanText = '今日有拜访';
          } else {
            nextPlanText = item.nextPlan.plan_date.slice(5).replace('-', '/') + ' 有拜访';
          }
        } else {
          nextPlanText = '未安排';
        }
        var stage = item.customer.stage;
        return {
          id: item.customer.id,
          planId: item.nextPlan ? item.nextPlan.id : null,
          name: item.customer.name,
          stage: stage,
          stageClass: STAGE_CLASS_MAP[stage] || 'comm',
          priorityLevel: item.priority.level,
          priorityLabel: item.priority.label,
          nextPlanText: nextPlanText,
          isOverdue: item.nextPlan && item.nextPlan.plan_date < todayStr
        };
      });

      // 副文案
      var unplannedCount = 0;
      for (var k = 0; k < pendingFollowUp.length; k++) {
        if (pendingFollowUp[k].planId === null) unplannedCount++;
      }
      var greetingSubtext = '';
      var greetingWarn = false;
      if (unplannedCount > 0) {
        greetingSubtext = '待跟进的 ' + unplannedCount + ' 位客户还没有安排拜访';
        greetingWarn = true;
      } else if (hour >= 18 && todayPlans.length > 0) {
        greetingSubtext = '今天的拜访都安排好了，辛苦了';
      } else if (todayPlans.length > 0) {
        greetingSubtext = '今天有 ' + todayPlans.length + ' 个拜访计划，加油';
      } else if (overdueCount > 0) {
        greetingSubtext = '有 ' + overdueCount + ' 条逾期计划待处理';
      } else {
        greetingSubtext = '今天还没有拜访计划，要不要安排一下？';
      }

      this.setData({
        greetingPrefix: greetingPrefix,
        greetingSubtext: greetingSubtext,
        greetingWarn: greetingWarn,
        overdueCount: overdueCount,
        todayPlans: todayPlans,
        metrics: metrics,
        stageFunnel: stageFunnel,
        funnelMax: funnelMax,
        pendingFollowUp: pendingFollowUp,
        isEmpty: snapshot.customer.length === 0
      });
    } catch (e) {
      Toast.fail('数据加载失败');
      console.error('[Dashboard] _refresh error:', e);
    }
  },

  onPeriodTap: function () {
    this.setData({ showPeriodDropdown: !this.data.showPeriodDropdown });
  },

  onPeriodSelect: function (e) {
    var period = e.currentTarget.dataset.period;
    if (period === this.data.currentPeriod) {
      this.setData({ showPeriodDropdown: false });
      return;
    }
    this.setData({ currentPeriod: period, showPeriodDropdown: false });
    this._updatePeriodDisplay();
    this._refresh();
  },

  onDropdownMaskTap: function () {
    this.setData({ showPeriodDropdown: false });
  },

  /** 点击今日拜访「执行」 */
  onExecutePlan: function (e) {
    var planId = parseInt(e.currentTarget.dataset.id);
    var plan = this.data.todayPlans.filter(function(p) { return p.id === planId; })[0];
    if (!plan) return;
    wx.navigateTo({
      url: '/pages/record-new/index?customer_id=' + plan.customer_id +
           '&customer_name=' + encodeURIComponent(plan.customerName) +
           '&plan_id=' + plan.id +
           '&plan_date=' + plan.plan_date +
           '&plan_time=' + (plan.plan_time || '') +
           '&visit_way=' + encodeURIComponent(plan.visit_way || '面对面') +
           '&record_type=planned'
    });
  },

  /** 点击逾期警示条：滚动到待跟进区域 */
  onOverdueTap: function () {
    var query = wx.createSelectorQuery();
    query.selectViewport().scrollOffset();
    query.select('#follow-section').boundingClientRect();
    query.exec(function (res) {
      var scrollTop = res[0] ? res[0].scrollTop : 0;
      var rect = res[1];
      if (rect) {
        wx.pageScrollTo({ scrollTop: scrollTop + rect.top - 16, duration: 300 });
      }
    });
  },

  /** 点击待跟进客户：跳转客户详情计划 tab */
  onFollowUpTap: function (e) {
    var id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/customer-detail/index?id=' + id + '&tab=plan' });
  },

  /** 点击「全部」跳转节奏 tab */
  onGoPlanList: function () {
    wx.switchTab({ url: '/pages/rhythm/index' });
  },

  onGoAddCustomer: function () {
    wx.switchTab({ url: '/pages/customer/index' });
  },

  onGoAddPlan: function () {
    wx.switchTab({ url: '/pages/customer/index' });
  }
});

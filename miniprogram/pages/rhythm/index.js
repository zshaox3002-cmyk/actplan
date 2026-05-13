/**
 * rhythm/index.js — 节奏页（销售推进行动提醒）v1.2
 */

var storage = require('../../utils/storage');
var rhythm = require('../../utils/rhythm');
var dateUtil = require('../../utils/date');
var constants = require('../../utils/constants');
var planRepo = require('../../utils/repository/plan.repo');
var toast = require('../../utils/toast');

var CATEGORY_LABEL = {
  stuck: '卡点待处理',
  breakRisk: '断档风险',
  shouldAdvance: '该推进了'
};

var STAGE_ACTION_MAP = {
  '需求沟通': { stuck: '建议重新进行需求沟通', breakRisk: '建议重新预约需求沟通' },
  '方案讲解': { stuck: '建议重新评估推进策略', breakRisk: '建议追踪方案反馈' },
  '待促成':   { stuck: '建议重新评估推进策略', breakRisk: '建议尽快安排促成沟通' },
  '初步认识': { stuck: '建议重新评估推进策略', breakRisk: '' }
};

Page({
  data: {
    activeTab: 'stuck',
    stuckList: [],
    breakRiskList: [],
    shouldAdvanceList: [],
    totalCount: 0,
    summaryText: '',
    isLowData: false,
    loading: true,
    showPlanSheet: false,
    planSheetCustomerId: null,
    planSheetCustomerName: '',
    planSheetDate: '',
    planSheetTime: '',
    planSheetVisitWay: '面对面',
    planSheetVisitWayOptions: [],
    isSaving: false
  },

  onLoad: function () {
    this._loadData();
  },

  onShow: function () {
    this._loadData();
  },

  _loadData: function () {
    var self = this;
    storage.waitReady().then(function () {
      var customers = storage.getTable('customer');
      var records   = storage.getTable('visit_record');
      var plans     = storage.getTable('plan');
      var notes     = storage.getTable('objection_note');
      var policies  = storage.getTable('policy');
      var today     = dateUtil.today();

      var cfg = rhythm.RHYTHM_RULE_CONFIG;
      var isLowData = customers.length < cfg.lowDataCustomerCount || records.length < cfg.lowDataRecordCount;

      var result = rhythm.classifyCustomers(customers, records, plans, notes, today, policies);

      var stuckList = result.stuck.map(function (item) { return self._toCardData(item); });
      var breakRiskList = result.breakRisk.map(function (item) { return self._toCardData(item); });
      var shouldAdvanceList = result.shouldAdvance.map(function (item) { return self._toCardData(item); });

      var totalCount = stuckList.length + breakRiskList.length + shouldAdvanceList.length;
      var summaryText = totalCount > 0
        ? '本周建议处理 ' + totalCount + ' 位客户'
        : '当前没有明显需要处理的节奏提醒';

      // 默认 Tab：优先卡点，其次断档，其次推进
      var activeTab = 'stuck';
      if (stuckList.length === 0 && breakRiskList.length === 0 && shouldAdvanceList.length === 0) {
        activeTab = 'stuck';
      } else if (stuckList.length > 0) {
        activeTab = 'stuck';
      } else if (breakRiskList.length > 0) {
        activeTab = 'breakRisk';
      } else {
        activeTab = 'shouldAdvance';
      }

      self.setData({
        stuckList: stuckList,
        breakRiskList: breakRiskList,
        shouldAdvanceList: shouldAdvanceList,
        totalCount: totalCount,
        summaryText: summaryText,
        isLowData: isLowData,
        activeTab: activeTab,
        loading: false
      });
    });
  },

  /**
   * 将分类结果项转换为卡片展示数据
   * @param {Object} item
   * @returns {Object}
   */
  _toCardData: function (item) {
    var c = item.customer;
    var stageClass = constants.STAGE_CLASS_MAP[c.stage] || 'comm';
    var category = item.type;
    var categoryLabel = CATEGORY_LABEL[category];
    var reasonText = '';
    var evidenceText = '';
    var actionText = '';
    var detailTab = 'timeline';
    var showObjBtn = false;

    if (category === 'stuck') {
      var info = item.stuckInfo;
      var primary = info.primaryReason;
      reasonText = primary.text;
      evidenceText = primary.evidence;
      actionText = this._getStuckAction(primary, c.stage);
      showObjBtn = info.hasUnresolvedObjection;
      detailTab = info.hasUnresolvedObjection ? 'objection' : 'timeline';

    } else if (category === 'breakRisk') {
      var bi = item.breakInfo;
      reasonText = '当前没有下次计划，且已超过' + c.stage + '阶段合理跟进间隔';
      evidenceText = '最近有效动作距今 ' + bi.daysSinceLastAction + ' 天，阶段阈值为 ' + bi.followThreshold + ' 天';
      var stageActions = STAGE_ACTION_MAP[c.stage] || {};
      actionText = stageActions.breakRisk || '建议尽快安排跟进';
      detailTab = 'plan';

    } else if (category === 'shouldAdvance') {
      var ai = item.advanceInfo;
      if (ai.trigger === 'smooth') {
        reasonText = '最近一次沟通进展顺利，适合继续推进';
        evidenceText = '最近 ' + rhythm.RHYTHM_RULE_CONFIG.positiveSmoothDays + ' 天内沟通结果为"顺利"';
        actionText = '建议预约下一次沟通';
      } else {
        reasonText = '阶段近期有正向推进，适合跟进巩固';
        evidenceText = '最近 ' + rhythm.RHYTHM_RULE_CONFIG.positiveStageAdvanceDays + ' 天内阶段有推进';
        actionText = '建议补充下一步计划';
      }
      detailTab = 'plan';
    }

    var primaryAction = 'plan';
    if (category === 'stuck') {
      primaryAction = showObjBtn ? 'objection' : 'note';
    }

    return {
      id: c.id,
      name: c.name,
      stage: c.stage,
      stageClass: stageClass,
      category: category,
      categoryLabel: categoryLabel,
      reasonText: reasonText,
      evidenceText: evidenceText,
      actionText: actionText,
      showObjBtn: showObjBtn,
      primaryAction: primaryAction
    };
  },

  /**
   * 根据卡点原因和阶段返回推荐动作文案
   * @param {Object} reason
   * @param {string} stage
   * @returns {string}
   */
  _getStuckAction: function (reason, stage) {
    if (reason.type === 'blocked') return '建议记录并处理受阻原因';
    if (reason.type === 'objection') return '建议查看异议并补充应对记录';
    if (reason.type === 'missing_need') return '建议重新进行需求沟通';
    if (reason.type === 'missing_ability') return '建议确认预算范围或调整方案';
    if (reason.type === 'missing_decider') return '建议确认实际决策人';
    var stageActions = STAGE_ACTION_MAP[stage] || {};
    return stageActions.stuck || '建议重新评估推进策略';
  },

  onTabChange: function (e) {
    this.setData({ activeTab: e.currentTarget.dataset.tab });
  },

  onAddPlan: function (e) {
    var id = e.currentTarget.dataset.id;
    var name = e.currentTarget.dataset.name;
    this.setData({
      showPlanSheet: true,
      planSheetCustomerId: id,
      planSheetCustomerName: name,
      planSheetDate: dateUtil.today(),
      planSheetTime: '',
      planSheetVisitWay: '面对面',
      planSheetVisitWayOptions: constants.VISIT_WAY_OPTIONS
    });
  },

  onPlanSheetDateChange: function (e) {
    this.setData({ planSheetDate: e.detail.value });
  },

  onPlanSheetTimeChange: function (e) {
    this.setData({ planSheetTime: e.detail.value });
  },

  onPlanSheetVisitWayChange: function (e) {
    this.setData({ planSheetVisitWay: constants.VISIT_WAY_OPTIONS[e.detail.value] });
  },

  onPlanSheetClearTime: function () {
    this.setData({ planSheetTime: '' });
  },

  onPlanSheetCancel: function () {
    this.setData({ showPlanSheet: false });
  },

  onPlanSheetConfirm: function () {
    if (this.data.isSaving) return;
    var d = this.data;
    if (!d.planSheetTime) {
      toast.fail('请选择计划时间');
      return;
    }
    this.setData({ isSaving: true });
    try {
      var result = planRepo.create({
        customer_id: d.planSheetCustomerId,
        plan_date: d.planSheetDate,
        plan_time: d.planSheetTime,
        visit_way: d.planSheetVisitWay
      });
      if (result.conflict) {
        toast.fail('该客户当日已有计划');
        return;
      }
      toast.success('添加成功');
      this.setData({ showPlanSheet: false });
    } finally {
      this.setData({ isSaving: false });
    }
  },

  onAddRecord: function (e) {
    var id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/record-new/index?customer_id=' + id + '&record_type=adhoc' });
  },

  onViewObjection: function (e) {
    var id = parseInt(e.currentTarget.dataset.id);
    wx.navigateTo({ url: '/pages/customer-detail/index?id=' + id + '&tab=objection' });
  }
});

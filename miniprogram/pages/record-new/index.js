/**
 * record-new/index.js — 新建拜访记录
 *
 * 两种入口：
 * - planned：从计划页「执行」进入，携带 customer_id/plan_id/plan_date/plan_time/visit_way
 * - adhoc：从客户列表/详情「+记录」进入，仅携带 customer_id
 *
 * 字段顺序：沟通结果 → 摘要 → 涉及异议 → 跟进阶段 → 下次跟进
 */

var recordRepo = require('../../utils/repository/record.repo');
var customerRepo = require('../../utils/repository/customer.repo');
var planRepo = require('../../utils/repository/plan.repo');
var objectionRepo = require('../../utils/repository/objection.repo');
var policyRepo = require('../../utils/repository/policy.repo');
var storage = require('../../utils/storage');
var toast = require('../../utils/toast');
var constants = require('../../utils/constants');
var dateUtil = require('../../utils/date');

var STAGE_OPTIONS = ['初步认识', '需求沟通', '方案讲解', '待促成', '已成交', '已流失'];

var STAGE_CLASS_MAP = {
  '初步认识': 'meet',
  '需求沟通': 'comm',
  '方案讲解': 'present',
  '待促成': 'closing',
  '已成交': 'deal',
  '已流失': 'lost'
};

var COMM_RESULTS = [
  { key: 'smooth', label: '进展顺利', emoji: '😊' },
  { key: 'normal', label: '一般', emoji: '😐' },
  { key: 'blocked', label: '受阻', emoji: '😟' },
  { key: 'deal', label: '已成交', emoji: '✅' }
];

var NEXT_FOLLOW_SHORTCUTS = [
  { key: 'none', label: '不安排' },
  { key: 'tomorrow', label: '明天' },
  { key: '3days', label: '3天后' },
  { key: 'week', label: '一周后' },
  { key: 'custom', label: '自定义' }
];

var OBJECTION_RESULTS = ['已化解', '仍在考虑', '未化解'];

Page({
  data: {
    // 入口模式
    recordType: 'planned',   // 'planned' | 'adhoc'

    // 客户信息（只读）
    customerId: '',
    customerName: '',

    // 计划信息（planned 模式显示）
    planId: '',
    planDate: '',
    planTime: '',
    visitWay: '面对面',
    planGoal: '',

    // 沟通结果
    commResults: COMM_RESULTS,
    commResultKey: '',

    // 成交信息子区块（commResultKey='deal' 时展开）
    showDealBlock: false,
    dealProducts: [],
    dealPremiums: {},
    dealProductNames: {},
    dealProductsMap: {},
    productTypeOptions: ['重疾', '医疗', '教育金', '养老', '意外', '寿险'],

    // 沟通摘要
    summary: '',

    // 异议（从 repo 加载的客户已有异议）
    objections: [],           // { id, content, category, resolved: false }

    // 跟进阶段
    stageOptions: STAGE_OPTIONS,
    stageClassMap: STAGE_CLASS_MAP,
    stageIndex: 0,
    currentStage: '',         // 客户当前阶段

    // 下次跟进
    nextPlanCreated: false,
    nextPlanText: '',

    // 预约弹窗
    showPlanSheet: false,
    planSheetDate: '',
    planSheetTime: '',
    planSheetVisitWay: '面对面',
    planSheetGoal: '',
    visitWayOptions: ['面对面', '电话', '微信'],

    // 选择异议 sheet
    showObjSheet: false,
    objSheetList: [],

    // 保存防重复
    isSaving: false
  },

  _justCreatedIds: null,

  onLoad: function (options) {
    this._justCreatedIds = [];

    var customerId = options.customer_id ? parseInt(options.customer_id) : '';
    var recordType = options.record_type || (options.plan_id ? 'planned' : 'adhoc');
    var planId = options.plan_id ? parseInt(options.plan_id) : '';
    var planDate = options.plan_date || '';
    var planTime = options.plan_time || '';
    var visitWay = options.visit_way
      ? (function(v) { try { return decodeURIComponent(v); } catch(e) { return v; } })(options.visit_way)
      : '面对面';
    var planGoal = options.plan_goal
      ? (function(v) { try { return decodeURIComponent(v); } catch(e) { return v; } })(options.plan_goal)
      : '';
    var customerName = options.customer_name
      ? (function(v) { try { return decodeURIComponent(v); } catch(e) { return v; } })(options.customer_name)
      : '';

    var stageIndex = 0;
    var currentStage = '';
    if (customerId) {
      var customer = customerRepo.get(customerId);
      if (customer) {
        if (!customerName) customerName = customer.name || '';
        currentStage = customer.stage || '';
        var idx = STAGE_OPTIONS.indexOf(currentStage);
        if (idx >= 0) stageIndex = idx;
      }
    }

    // 加载客户已有异议
    var objections = [];
    if (customerId) {
      var allObjections = storage.getTable('objection') || [];
      var customerObjs = allObjections.filter(function(o) {
        return o.customer_id === customerId;
      });
      objections = customerObjs.filter(function(o) {
        var notes = objectionRepo.listNotes(o.id);
        return !(notes.length > 0 && notes[0].result === '已化解');
      }).map(function(o) {
        return { id: o.id, content: o.content || '', category: o.category || '', resolved: false };
      });
    }

    this.setData({
      recordType: recordType,
      customerId: customerId,
      customerName: customerName,
      planId: planId,
      planDate: planDate,
      planTime: planTime,
      visitWay: visitWay,
      planGoal: planGoal,
      stageIndex: stageIndex,
      currentStage: currentStage,
      objections: objections
    });
  },

  /** 选择沟通结果 */
  onCommResultTap: function (e) {
    var key = e.currentTarget.dataset.key;
    var update = {
      commResultKey: key,
      showDealBlock: key === 'deal'
    };
    // 选已成交时自动联动跟进阶段
    if (key === 'deal') {
      update.stageIndex = STAGE_OPTIONS.indexOf('已成交');
    }
    this.setData(update);
  },

  /** 沟通摘要输入 */
  onSummaryInput: function (e) {
    this.setData({ summary: e.detail.value });
  },

  /** 成交险种多选切换 */
  onDealProductToggle: function (e) {
    var type = e.currentTarget.dataset.type;
    var products = this.data.dealProducts.slice();
    var premiums = Object.assign({}, this.data.dealPremiums);
    var names = Object.assign({}, this.data.dealProductNames);
    var idx = products.indexOf(type);
    if (idx >= 0) {
      products.splice(idx, 1);
      delete premiums[type];
      delete names[type];
    } else {
      products.push(type);
      premiums[type] = '';
      names[type] = '';
    }
    var map = {};
    for (var i = 0; i < products.length; i++) map[products[i]] = true;
    this.setData({ dealProducts: products, dealPremiums: premiums, dealProductNames: names, dealProductsMap: map });
  },

  /** 各险种产品名称输入 */
  onDealProductNameInput: function (e) {
    var type = e.currentTarget.dataset.type;
    var names = Object.assign({}, this.data.dealProductNames);
    names[type] = e.detail.value;
    this.setData({ dealProductNames: names });
  },

  /** 各险种保费输入 */
  onDealPremiumInput: function (e) {
    var type = e.currentTarget.dataset.type;
    var premiums = Object.assign({}, this.data.dealPremiums);
    premiums[type] = e.detail.value;
    this.setData({ dealPremiums: premiums });
  },

  /** 切换异议已化解状态 */
  onObjResolvedToggle: function(e) {
    var index = parseInt(e.currentTarget.dataset.index);
    var objections = this.data.objections.slice();
    objections[index] = Object.assign({}, objections[index], { resolved: !objections[index].resolved });
    this.setData({ objections: objections });
  },

  /** 打开异议选择 sheet */
  onAddObjection: function() {
    var existingIds = this.data.objections.map(function(o) { return o.id; });
    var all = objectionRepo.list({ sortBy: 'count' });
    var list = all.map(function(o) {
      return {
        id: o.id,
        content: o.content || o.title || '',
        category: o.category || '',
        count: o.occurrenceCount || o.count || 0,
        selected: existingIds.indexOf(o.id) >= 0
      };
    });
    this.setData({ showObjSheet: true, objSheetList: list });
  },

  onObjSheetItemTap: function(e) {
    var idx = parseInt(e.currentTarget.dataset.index);
    var list = this.data.objSheetList.slice();
    list[idx] = Object.assign({}, list[idx], { selected: !list[idx].selected });
    this.setData({ objSheetList: list });
  },

  onObjSheetConfirm: function() {
    var existingIds = this.data.objections.map(function(o) { return o.id; });
    var toAdd = this.data.objSheetList.filter(function(o) {
      return o.selected && existingIds.indexOf(o.id) < 0;
    });
    var objections = this.data.objections.slice();
    toAdd.forEach(function(o) {
      objections.push({ id: o.id, content: o.content, category: o.category, resolved: false });
    });
    this.setData({ showObjSheet: false, objections: objections });
  },

  onObjSheetCancel: function() {
    this.setData({ showObjSheet: false });
  },

  onObjSheetCreateNew: function() {
    var that = this;
    this.setData({ showObjSheet: false });
    wx.navigateTo({
      url: '/pages/objection-new/index?customer_id=' + this.data.customerId,
      events: {
        onObjectionCreated: function(data) {
          var objections = that.data.objections.slice();
          objections.push({ id: data.id, content: data.content || '', category: data.category || '', resolved: false });
          that.setData({ objections: objections });
        }
      }
    });
  },

  /** 跟进阶段推进按钮 */
  onStageTap: function (e) {
    var idx = parseInt(e.currentTarget.dataset.idx);
    this.setData({ stageIndex: idx });
  },

  /** 页面显示时刷新下次计划 */
  onShow: function() {
    var customerId = this.data.customerId;
    if (!customerId) return;
    var allPlans = planRepo.listAll ? planRepo.listAll() : [];
    var futurePlans = allPlans.filter(function(p) {
      return p.customer_id === customerId && p.status === '待执行';
    });
    futurePlans.sort(function(a, b) { return a.plan_date > b.plan_date ? 1 : -1; });
    var next = futurePlans[0];
    if (next) {
      var way = next.visit_way || '面对面';
      try { way = decodeURIComponent(way); } catch(e) {}
      this.setData({ nextPlanCreated: true, nextPlanText: next.plan_date + ' · ' + way });
    }
  },

  /** 跳转计划选择页 */
  onGoToPlanSelect: function() {
    wx.navigateTo({
      url: '/pages/plan-select/index?customer_id=' + this.data.customerId +
           '&customer_name=' + encodeURIComponent(this.data.customerName)
    });
  },

  /** 打开预约弹窗 */
  onOpenPlanSheet: function() {
    this.setData({
      showPlanSheet: true,
      planSheetDate: dateUtil.today(),
      planSheetTime: '',
      planSheetVisitWay: '面对面',
      planSheetGoal: ''
    });
  },

  onPlanSheetDateChange: function(e) {
    this.setData({ planSheetDate: e.detail.value });
  },

  onPlanSheetTimeChange: function(e) {
    this.setData({ planSheetTime: e.detail.value });
  },

  onPlanSheetClearTime: function() {
    this.setData({ planSheetTime: '' });
  },

  onPlanSheetCancel: function() {
    this.setData({ showPlanSheet: false });
  },

  onPlanSheetWayChange: function(e) {
    this.setData({ planSheetVisitWay: e.currentTarget.dataset.way });
  },

  onPlanSheetGoalInput: function(e) {
    this.setData({ planSheetGoal: e.detail.value });
  },

  onPlanSheetConfirm: function() {
    if (this.data.isSaving) return;
    this.setData({ isSaving: true });

    var d = this.data;
    if (!d.planSheetDate) {
      wx.showToast({ title: '请选择日期', icon: 'none' });
      this.setData({ isSaving: false });
      return;
    }
    var result = planRepo.create({
      customer_id: d.customerId,
      plan_date: d.planSheetDate,
      plan_time: d.planSheetTime || null,
      visit_way: d.planSheetVisitWay,
      goal: d.planSheetGoal || '',
      status: '待执行'
    });
    if (result && result.conflict) {
      wx.showToast({ title: '该客户当日已有计划', icon: 'none' });
      this.setData({ isSaving: false });
      return;
    }
    var text = d.planSheetDate + ' · ' + d.planSheetVisitWay;
    if (d.planSheetTime) text += ' · ' + d.planSheetTime;
    this.setData({ showPlanSheet: false, nextPlanCreated: true, nextPlanText: text });
    this.setData({ isSaving: false });
  },

  /** 保存记录 */
  onSave: function () {
    if (this.data.isSaving) return;
    this.setData({ isSaving: true });

    var d = this.data;
    var summary = (d.summary || '').trim();

    if (!summary) {
      wx.showToast({ title: '请填写沟通摘要', icon: 'none' });
      this.setData({ isSaving: false });
      return;
    }

    var selectedStage = STAGE_OPTIONS[d.stageIndex];

    // 成交信息校验
    if (d.showDealBlock) {
      if (!d.dealProducts || d.dealProducts.length === 0) {
        wx.showToast({ title: '请选择成交险种', icon: 'none' });
        this.setData({ isSaving: false });
        return;
      }
      for (var k = 0; k < d.dealProducts.length; k++) {
        var pt = d.dealProducts[k];
        if (!d.dealPremiums[pt] || isNaN(parseFloat(d.dealPremiums[pt]))) {
          wx.showToast({ title: '请填写' + pt + '的保费金额', icon: 'none' });
          this.setData({ isSaving: false });
          return;
        }
        if (!d.dealProductNames[pt] || !d.dealProductNames[pt].trim()) {
          wx.showToast({ title: '请填写' + pt + '的产品名称', icon: 'none' });
          this.setData({ isSaving: false });
          return;
        }
      }
    }

    try {
      // 1. 处理异议
      var objectionIds = [];
      for (var i = 0; i < d.objections.length; i++) {
        var obj = d.objections[i];
        var result = obj.resolved ? '已化解' : '仍在考虑';
        objectionRepo.appendNote(obj.id, d.customerId, '在本次拜访中遇到该异议', {
          result: result
        });
        objectionIds.push(obj.id);
      }

      // 2. 保存拜访记录（recordRepo.create 内部已有事务）
      var recordData = {
        customer_id: d.customerId,
        plan_id: d.planId || null,
        visit_date: d.planDate || new Date().toISOString().slice(0, 10),
        visit_time: d.planTime || null,
        visit_way: d.visitWay || '面对面',
        summary: summary,
        stage: selectedStage,
        comm_result: d.commResultKey,
        record_type: d.recordType,
        is_deal: selectedStage === '已成交' ? '签单成交' : '暂未成交',
        has_objection: objectionIds.length > 0 ? 1 : 0,
        objection_ids: objectionIds,
        updated_fields: ['stage']
      };

      // 成交时附加保单字段
      if (d.showDealBlock) {
        var totalPremium = 0;
        for (var pi = 0; pi < d.dealProducts.length; pi++) {
          totalPremium += parseFloat(d.dealPremiums[d.dealProducts[pi]] || 0);
        }
        recordData.deal_products = d.dealProducts;
        recordData.deal_premium = totalPremium;
      }

      // recordRepo.create 返回新记录 ID（数字）
      var newRecordId = recordRepo.create(recordData);

      // 3. 同步客户阶段（recordRepo 内部已更新，此处补充 segment 相关字段）
      customerRepo.update(d.customerId, { stage: selectedStage });

      // 4. 成交时为每个险种创建保单记录，并更新 coverage_status
      if (d.showDealBlock && newRecordId) {
        var newCoverageStatus = {};

        for (var j = 0; j < d.dealProducts.length; j++) {
          var productType = d.dealProducts[j];
          policyRepo.create({
            customer_id: d.customerId,
            product_type: productType,
            product_name: d.dealProductNames[productType] || '',
            premium: parseFloat(d.dealPremiums[productType] || 0),
            effective_date: null,
            expire_date: null,
            visit_record_id: newRecordId
          });
          newCoverageStatus[productType] = 'configured';
        }

        // 强制覆盖 configured 状态（_forceStatus 标记绕过校验）
        customerRepo.update(d.customerId, { coverage_status: newCoverageStatus, _forceStatus: true });
      }

      toast.success('记录已保存');
      setTimeout(function () { wx.navigateBack(); }, 800);
    } catch (e) {
      toast.fail('保存失败：' + (e.message || ''));
      this.setData({ isSaving: false });
    }
  }
});

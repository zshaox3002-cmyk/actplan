/**
 * customer-detail/index.js — 客户跟进工作台
 *
 * 5 Tab：画像 / 沟通 / 异议 / 需求 / 计划
 * 顶部卡片：优先级标签、阶段标签、自定义标签、+计划/+记录
 */

var customerRepo = require('../../utils/repository/customer.repo');
var recordRepo = require('../../utils/repository/record.repo');
var planRepo = require('../../utils/repository/plan.repo');
var objectionRepo = require('../../utils/repository/objection.repo');
var storage = require('../../utils/storage');
var priority = require('../../utils/priority');
var toast = require('../../utils/toast');
var dateUtil = require('../../utils/date');
var constants = require('../../utils/constants');

var STAGE_OPTIONS = ['初步认识', '需求沟通', '方案讲解', '待促成', '已成交', '已流失'];

var STAGE_CLASS_MAP = {
  '初步认识': 'meet',
  '需求沟通': 'comm',
  '方案讲解': 'present',
  '待促成':   'closing',
  '已成交':   'deal',
  '已流失':   'lost'
};

var NEED_VAL_CLASS = {
  '关注中':   'need-val need-val-high',
  '有兴趣':   'need-val need-val-mid',
  '待了解':   'need-val need-val-low',
  '暂不考虑': 'need-val need-val-none'
};

/** 根据需求状态返回对应颜色 class */
function getNeedValClass(val) {
  return NEED_VAL_CLASS[val] || 'need-val need-val-low';
}

/** 计算 coverageNeedClasses 数组 */
function buildNeedClasses(keys, needs) {
  return keys.map(function (k) { return getNeedValClass(needs[k]); });
}

function findIndex(options, value) {
  if (value == null) return -1;
  return options.indexOf(value);
}

function getValue(options, index) {
  return index >= 0 ? options[index] : null;
}

Page({
  data: {
    loading: true,
    isNew: false,
    id: null,

    // 顶部卡片
    customerName: '',
    priorityLevel: '',
    priorityLabel: '',
    stageLabel: '',
    stageClassMap: STAGE_CLASS_MAP,
    tags: [],
    lastVisit: '',
    nextPlanText: '',

    // Tab 切换
    activeTab: 'profile', // profile / timeline / objection / needs / plan

    // 画像 Tab — 编辑态
    isEditProfile: false,
    form: {
      name: '',
      coverage_gap: '',
      last_visit: '',
      visit_count: 0
    },
    genderOptions: ['男', '女', '未知'],
    genderIndex: 2,
    relationOptions: ['同事', '朋友', '亲戚', '同学', '邻居', '客户介绍', '陌生拜访', '其他'],
    relationIndex: -1,
    incomeOptions: ['10万以下', '10–30万', '30–50万', '50–100万', '100–300万', '300万以上', '未知'],
    incomeIndex: -1,
    ageRangeOptions: ['25岁以下', '25–34岁', '35–44岁', '45–54岁', '55–64岁', '65岁以上'],
    ageRangeIndex: -1,
    occupationOptions: ['企业职员', '企业管理层', '个体经营', '自由职业', '医疗/教育/公务员', '金融从业者', '工程技术', '全职家庭', '学生', '其他'],
    occupationIndex: -1,
    residenceOptions: ['自住房（无贷）', '自住房（有贷）', '租房', '与父母同住', '其他'],
    residenceIndex: -1,
    maritalOptions: ['未婚', '已婚–无子', '已婚–有子', '离异', '丧偶'],
    maritalIndex: -1,
    intimacyOptions: ['陌生', '普通朋友', '熟人', '好友', '亲密'],
    intimacyIndex: -1,
    familyOptions: ['单身', '夫妻二人', '有未成年子女', '有成年子女', '与父母同住', '三代同堂'],
    familyIndex: -1,
    hasNeedOptions: ['是', '否', '不确定'],
    hasNeedIndex: 2,
    hasAbilityOptions: ['是', '否', '不确定'],
    hasAbilityIndex: 2,
    isDeciderOptions: ['是', '否', '不确定'],
    isDeciderIndex: 2,
    stageOptions: STAGE_OPTIONS,
    stageIndex: 0,

    // 沟通 Tab
    timeline: [],
    timelineVisible: [],
    timelineTotal: 0,
    timelineExpanded: false,

    // 异议 Tab
    customerObjections: [],
    showObjSheet: false,
    objSheetList: [],

    // 需求 Tab — 编辑态
    isEditNeeds: false,
    coverageNeeds: {},    // { 重疾: '关注中', 医疗: '待了解', ... }
    coverageNeedOptions: ['关注中', '有兴趣', '待了解', '暂不考虑'],
    coverageNeedKeys: ['重疾', '医疗', '教育金', '养老', '意外', '寿险'],
    coverageNeedIndexes: [],  // 编辑态各字段选中索引
    coverageNeedClasses: [],  // 非编辑态各字段颜色 class

    // 计划 Tab
    customerPlans: [],

    // 标签输入
    tagInput: '',

    // 添加计划底部 sheet
    showPlanSheet: false,
    planSheetMode: 'add',   // 'add' | 'edit'
    planSheetPlanId: null,
    planSheetDate: '',
    planSheetTime: '',
    planSheetVisitWay: '面对面',
    planSheetVisitWayOptions: []
  },

  onLoad: function (options) {
    var self = this;

    if (options && options.tab) {
      this.setData({ activeTab: options.tab });
    }

    if (options && options.id) {
      var id = parseInt(options.id);
      this._loadDetail(id);
    } else {
      // 新建模式
      this.setData({ isNew: true, isEditProfile: true, loading: false });
      wx.enableAlertBeforeUnload({ message: '当前有未保存的修改，确认放弃？' });
    }
  },

  onShow: function () {
    var id = this.data.id;
    if (id) this._loadDetail(id);
  },

  _loadDetail: function (id) {
    var customer = customerRepo.get(id);

    if (!customer) {
      toast.fail('客户不存在');
      setTimeout(function () { wx.navigateBack(); }, 1500);
      return;
    }

    // 计算优先级
    var allPlans = planRepo.listAll();
    var nextPlan = null;
    for (var i = 0; i < allPlans.length; i++) {
      var p = allPlans[i];
      if (p.customer_id === id && p.status === '待执行') {
        if (!nextPlan || p.plan_date < nextPlan.plan_date) nextPlan = p;
      }
    }
    var pri = priority.calculatePriority(customer, nextPlan);

    // 下次跟进展示文字
    var safeDecodeWay = function (v) { try { return decodeURIComponent(v); } catch (e) { return v; } };
    var nextPlanText = nextPlan
      ? nextPlan.plan_date + (nextPlan.plan_time ? ' ' + nextPlan.plan_time : '') + ' · ' + safeDecodeWay(nextPlan.visit_way || '面对面')
      : '未安排';

    // 沟通时间线
    var records = recordRepo.listByCustomer(id);
    var timeline = records.map(function (r) {
      return {
        id: r.id,
        date: r.visit_date,
        time: r.visit_time || '',
        type: r.record_type || 'planned',
        way: r.visit_way ? safeDecodeWay(r.visit_way) : '',
        summary: r.summary || '',
        stageChange: r.stage || '',
        nextDate: r.next_follow_date || ''
      };
    });

    // 该客户相关异议：从 record.objection_ids 和直接属于该客户的异议合并
    var objIds = [];
    for (var j = 0; j < records.length; j++) {
      var ids = records[j].objection_ids || [];
      for (var k = 0; k < ids.length; k++) {
        if (objIds.indexOf(ids[k]) === -1) objIds.push(ids[k]);
      }
    }
    // 直接查询属于该客户的异议
    var directObjections = storage.getTable('objection') || [];
    var directIds = directObjections
      .filter(function(o) { return o.customer_id === id; })
      .map(function(o) { return o.id; });
    for (var m = 0; m < directIds.length; m++) {
      if (objIds.indexOf(directIds[m]) === -1) objIds.push(directIds[m]);
    }

    var customerObjections = objIds.map(function (oid) {
      var obj = objectionRepo.get(oid);
      if (!obj) return null;
      var notes = objectionRepo.listNotes(oid);
      var latestResult = notes.length > 0 ? (notes[0].result || '未化解') : '';
      return {
        id: obj.id,
        category: obj.category || '',
        content: obj.content || '',
        solution: obj.solution || '',
        count: obj.count || 1,
        noteCount: notes.length,
        latestResult: latestResult,
        resultClass: latestResult === '已化解' ? 'resolved' : latestResult === '仍在考虑' ? 'pending' : 'unresolved'
      };
    }).filter(Boolean);

    // 该客户待执行计划
    var customerPlans = allPlans.filter(function (p) {
      return p.customer_id === id && p.status === '待执行';
    }).map(function (p) {
      var td = new Date(); var ts = td.getFullYear() + '-' + String(td.getMonth()+1).padStart(2,'0') + '-' + String(td.getDate()).padStart(2,'0');
      return Object.assign({}, p, { isOverdue: p.plan_date < ts });
    });

    var initData = {
      loading: false,
      isNew: false,
      id: id,
      customerName: customer.name || '',
      priorityLevel: pri ? pri.level : '',
      priorityLabel: pri ? pri.label : '',
      stageLabel: customer.stage || '',
      tags: customer.tags || [],
      lastVisit: customer.last_visit || '',
      nextPlanText: nextPlanText,
      form: {
        name: customer.name || '',
        coverage_gap: customer.coverage_gap || '',
        last_visit: customer.last_visit || '',
        visit_count: customer.visit_count || 0
      },
      genderIndex:     findIndex(this.data.genderOptions,     customer.gender),
      relationIndex:   findIndex(this.data.relationOptions,   customer.relation),
      incomeIndex:     findIndex(this.data.incomeOptions,     customer.income),
      ageRangeIndex:   findIndex(this.data.ageRangeOptions,   customer.age_range),
      occupationIndex: findIndex(this.data.occupationOptions, customer.occupation),
      residenceIndex:  findIndex(this.data.residenceOptions,  customer.residence),
      maritalIndex:    findIndex(this.data.maritalOptions,    customer.marital),
      intimacyIndex:   findIndex(this.data.intimacyOptions,   customer.intimacy),
      familyIndex:     findIndex(this.data.familyOptions,     customer.family),
      hasNeedIndex:    findIndex(this.data.hasNeedOptions,    customer.has_need),
      hasAbilityIndex: findIndex(this.data.hasAbilityOptions, customer.has_ability),
      isDeciderIndex:  findIndex(this.data.isDeciderOptions,  customer.is_decider),
      stageIndex:      Math.max(0, findIndex(STAGE_OPTIONS,   customer.stage)),
      // 画像只读态网格字段
      profileGender:     customer.gender || '',
      profileAgeRange:   customer.age_range || '',
      profileOccupation: customer.occupation || '',
      profileIncome:     customer.income || '',
      profileMarital:    customer.marital || '',
      profileFamily:     customer.family || '',
      profileIntimacy:   customer.intimacy || '',
      profileRelation:   customer.relation || '',
      timeline: timeline,
      timelineVisible: timeline.slice(0, 5),
      timelineTotal: timeline.length,
      timelineExpanded: false,
      customerObjections: customerObjections,
      customerPlans: customerPlans,
      coverageNeeds: customer.coverage_needs || {},
      coverageNeedClasses: buildNeedClasses(
        ['重疾', '医疗', '教育金', '养老', '意外', '寿险'],
        customer.coverage_needs || {}
      )
    };

    this.setData(initData);
  },

  onUnload: function () {
    wx.disableAlertBeforeUnload();
  },

  // ---- Tab 切换 ----

  onTabTap: function (e) {
    this.setData({ activeTab: e.currentTarget.dataset.tab });
  },

  // ---- 顶部快捷操作 ----

  /** +计划：底部弹窗 */
  onAddPlan: function () {
    this.setData({
      showPlanSheet: true,
      planSheetMode: 'add',
      planSheetPlanId: null,
      planSheetDate: dateUtil.today(),
      planSheetTime: '',
      planSheetVisitWay: '面对面',
      planSheetVisitWayOptions: constants.VISIT_WAY_OPTIONS
    });
  },

  /** @param {Object} e */
  onPlanSheetDateChange: function (e) {
    this.setData({ planSheetDate: e.detail.value });
  },

  /** @param {Object} e */
  onPlanSheetTimeChange: function (e) {
    this.setData({ planSheetTime: e.detail.value });
  },

  /** @param {Object} e */
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
    var d = this.data;
    if (d.planSheetMode === 'edit') {
      planRepo.update(d.planSheetPlanId, {
        plan_date: d.planSheetDate,
        plan_time: d.planSheetTime || null,
        visit_way: d.planSheetVisitWay
      });
      toast.success('已保存');
      var allPlans = planRepo.listAll();
      var id = this.data.id;
      var customerPlans = allPlans.filter(function (p) {
      return p.customer_id === id && p.status === '待执行';
    }).map(function (p) {
      var td = new Date(); var ts = td.getFullYear() + '-' + String(td.getMonth()+1).padStart(2,'0') + '-' + String(td.getDate()).padStart(2,'0');
      return Object.assign({}, p, { isOverdue: p.plan_date < ts });
    });
      this.setData({ showPlanSheet: false, customerPlans: customerPlans });
    } else {
      if (!d.planSheetTime) {
        toast.fail('请选择计划时间');
        return;
      }
      var result = planRepo.create({
        customer_id: d.id,
        plan_date: d.planSheetDate,
        plan_time: d.planSheetTime,
        visit_way: d.planSheetVisitWay
      });
      if (result.conflict) {
        toast.fail('该客户当日已有计划');
      } else {
        toast.success('添加成功');
        var allPlans = planRepo.listAll();
        var id = this.data.id;
        var customerPlans = allPlans.filter(function (p) {
      return p.customer_id === id && p.status === '待执行';
    }).map(function (p) {
      var td = new Date(); var ts = td.getFullYear() + '-' + String(td.getMonth()+1).padStart(2,'0') + '-' + String(td.getDate()).padStart(2,'0');
      return Object.assign({}, p, { isOverdue: p.plan_date < ts });
    });
        this.setData({ showPlanSheet: false, customerPlans: customerPlans });
      }
    }
  },

  /** +记录：跳转 record-new（adhoc 模式） */
  onAddRecord: function () {
    wx.navigateTo({
      url: '/pages/record-new/index?customer_id=' + this.data.id +
           '&customer_name=' + encodeURIComponent(this.data.customerName) +
           '&record_type=adhoc'
    });
  },

  // ---- 画像 Tab ----

  onEditProfileTap: function () {
    this.setData({ isEditProfile: true });
    wx.enableAlertBeforeUnload({ message: '当前有未保存的修改，确认放弃？' });
  },

  onFieldChange: function (e) {
    var field = e.currentTarget.dataset.field;
    var update = {};
    update['form.' + field] = e.detail.value;
    this.setData(update);
  },

  onGenderChange:     function (e) { this.setData({ genderIndex:     e.detail.value }); },
  onRelationChange:   function (e) { this.setData({ relationIndex:   e.detail.value }); },
  onIncomeChange:     function (e) { this.setData({ incomeIndex:     e.detail.value }); },
  onAgeRangeChange:   function (e) { this.setData({ ageRangeIndex:   e.detail.value }); },
  onOccupationChange: function (e) { this.setData({ occupationIndex: e.detail.value }); },
  onResidenceChange:  function (e) { this.setData({ residenceIndex:  e.detail.value }); },
  onMaritalChange:    function (e) { this.setData({ maritalIndex:    e.detail.value }); },
  onIntimacyChange:   function (e) { this.setData({ intimacyIndex:   e.detail.value }); },
  onFamilyChange:     function (e) { this.setData({ familyIndex:     e.detail.value }); },
  onHasNeedChange:    function (e) { this.setData({ hasNeedIndex:    e.detail.value }); },
  onHasAbilityChange: function (e) { this.setData({ hasAbilityIndex: e.detail.value }); },
  onIsDeciderChange:  function (e) { this.setData({ isDeciderIndex:  e.detail.value }); },
  onStageChange:      function (e) { this.setData({ stageIndex:      e.detail.value }); },

  /** 标签输入 */
  onTagInput: function (e) { this.setData({ tagInput: e.detail.value }); },

  /** 回车添加标签 */
  onTagConfirm: function () {
    var val = (this.data.tagInput || '').trim();
    if (!val) return;
    var tags = this.data.tags.slice();
    if (tags.indexOf(val) === -1) tags.push(val);
    this.setData({ tags: tags, tagInput: '' });
  },

  /** 删除标签 */
  onTagDelete: function (e) {
    var idx = parseInt(e.currentTarget.dataset.idx);
    var tags = this.data.tags.filter(function (_, i) { return i !== idx; });
    this.setData({ tags: tags });
  },

  /** 保存画像 */
  onSaveProfile: function () {
    var form = this.data.form;
    if (!form.name || !form.name.trim()) {
      toast.fail('请输入客户姓名');
      return;
    }

    var customerData = {
      name:         form.name,
      gender:       getValue(this.data.genderOptions,     this.data.genderIndex),
      relation:     getValue(this.data.relationOptions,   this.data.relationIndex),
      income:       getValue(this.data.incomeOptions,     this.data.incomeIndex),
      age_range:    getValue(this.data.ageRangeOptions,   this.data.ageRangeIndex),
      occupation:   getValue(this.data.occupationOptions, this.data.occupationIndex),
      residence:    getValue(this.data.residenceOptions,  this.data.residenceIndex),
      marital:      getValue(this.data.maritalOptions,    this.data.maritalIndex),
      intimacy:     getValue(this.data.intimacyOptions,   this.data.intimacyIndex),
      family:       getValue(this.data.familyOptions,     this.data.familyIndex),
      has_need:     getValue(this.data.hasNeedOptions,    this.data.hasNeedIndex),
      has_ability:  getValue(this.data.hasAbilityOptions, this.data.hasAbilityIndex),
      is_decider:   getValue(this.data.isDeciderOptions,  this.data.isDeciderIndex),
      stage:        STAGE_OPTIONS[this.data.stageIndex] || '需求沟通',
      tags:         this.data.tags
    };

    wx.disableAlertBeforeUnload();

    try {
      if (this.data.isNew) {
        customerRepo.create(customerData);
        toast.success('创建成功');
        setTimeout(function () { wx.navigateBack(); }, 1000);
      } else {
        customerRepo.update(this.data.id, customerData);
        this.setData({
          isEditProfile: false,
          customerName: customerData.name,
          stageLabel: customerData.stage,
          tags: customerData.tags,
          profileGender:     customerData.gender || '',
          profileAgeRange:   customerData.age_range || '',
          profileOccupation: customerData.occupation || '',
          profileIncome:     customerData.income || '',
          profileMarital:    customerData.marital || '',
          profileFamily:     customerData.family || '',
          profileIntimacy:   customerData.intimacy || '',
          profileRelation:   customerData.relation || ''
        });
        toast.success('保存成功');
      }
    } catch (e) {
      toast.fail('保存失败：' + e.message);
      wx.enableAlertBeforeUnload({ message: '当前有未保存的修改，确认放弃？' });
    }
  },

  // ---- 需求 Tab ----

  onEditNeedsTap: function () {
    var keys = this.data.coverageNeedKeys;
    var opts = this.data.coverageNeedOptions;
    var needs = this.data.coverageNeeds;
    var defaultIdx = opts.indexOf('待了解');
    var indexes = keys.map(function (k) {
      var idx = opts.indexOf(needs[k]);
      return idx >= 0 ? idx : defaultIdx;
    });
    this.setData({ isEditNeeds: true, coverageNeedIndexes: indexes });
  },

  onNeedIndexChange: function (e) {
    var fieldIdx = parseInt(e.currentTarget.dataset.idx);
    var selectedIdx = e.detail.value;
    var indexes = this.data.coverageNeedIndexes.slice();
    indexes[fieldIdx] = selectedIdx;
    this.setData({ coverageNeedIndexes: indexes });
  },

  onSaveNeeds: function () {
    var keys = this.data.coverageNeedKeys;
    var opts = this.data.coverageNeedOptions;
    var indexes = this.data.coverageNeedIndexes;
    var coverageNeeds = {};
    keys.forEach(function (k, i) {
      coverageNeeds[k] = opts[indexes[i]] || '待了解';
    });
    try {
      customerRepo.update(this.data.id, { coverage_needs: coverageNeeds });
      this.setData({
        isEditNeeds: false,
        coverageNeeds: coverageNeeds,
        coverageNeedClasses: buildNeedClasses(this.data.coverageNeedKeys, coverageNeeds)
      });
      toast.success('需求已保存');
    } catch (e) {
      toast.fail('保存失败：' + e.message);
    }
  },

  // ---- 沟通 Tab ----

  /** 展开全部沟通记录 */
  onExpandTimeline: function () {
    this.setData({ timelineExpanded: true, timelineVisible: this.data.timeline });
  },

  // ---- 异议 Tab ----

  /** 打开异议选择 sheet */
  onAddObjection: function () {
    var existingIds = this.data.customerObjections.map(function(o) { return o.id; });
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
    var existingIds = this.data.customerObjections.map(function(o) { return o.id; });
    var toAdd = this.data.objSheetList.filter(function(o) {
      return o.selected && existingIds.indexOf(o.id) < 0;
    });
    var objections = this.data.customerObjections.slice();
    toAdd.forEach(function(o) {
      objections.push({ id: o.id, category: o.category, content: o.content, count: o.count || 0 });
    });
    this.setData({ showObjSheet: false, customerObjections: objections });
  },

  onObjSheetCancel: function() {
    this.setData({ showObjSheet: false });
  },

  onObjSheetCreateNew: function() {
    var that = this;
    this.setData({ showObjSheet: false });
    wx.navigateTo({
      url: '/pages/objection-new/index?customer_id=' + this.data.id,
      events: {
        onObjectionCreated: function(data) {
          var objections = that.data.customerObjections.slice();
          objections.push({ id: data.id, category: data.category, content: data.content || '', count: 0 });
          that.setData({ customerObjections: objections });
        }
      }
    });
  },

  /** 查看异议详情 */
  onObjectionTap: function (e) {
    var id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/objection-detail/index?id=' + id });
  },

  // ---- 计划 Tab 操作 ----

  /** 完成记录：跳转 record-new 执行该计划 */
  onExecutePlanFromDetail: function (e) {
    var planId = parseInt(e.currentTarget.dataset.id);
    var plan = null;
    var plans = this.data.customerPlans;
    for (var i = 0; i < plans.length; i++) {
      if (plans[i].id === planId) { plan = plans[i]; break; }
    }
    if (!plan) return;
    wx.navigateTo({
      url: '/pages/record-new/index?customer_id=' + plan.customer_id +
           '&plan_id=' + plan.id +
           '&plan_date=' + plan.plan_date +
           '&plan_time=' + (plan.plan_time || '') +
           '&visit_way=' + encodeURIComponent(plan.visit_way || '面对面')
    });
  },

  /** 修改计划：跳转 plan-select 编辑模式 */
  onEditPlanFromDetail: function (e) {
    var planId = parseInt(e.currentTarget.dataset.id);
    var plan = this.data.customerPlans.filter(function(p) { return p.id === planId; })[0];
    if (!plan) return;
    this.setData({
      showPlanSheet: true,
      planSheetMode: 'edit',
      planSheetPlanId: planId,
      planSheetDate: plan.plan_date,
      planSheetTime: plan.plan_time || '',
      planSheetVisitWay: plan.visit_way || '面对面',
      planSheetVisitWayOptions: constants.VISIT_WAY_OPTIONS
    });
  },

  /** 删除计划：弹窗确认后删除并刷新列表 */
  onDeletePlanFromDetail: function (e) {
    var self = this;
    var planId = parseInt(e.currentTarget.dataset.id);
    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复。',
      confirmColor: '#EF4444',
      success: function (res) {
        if (res.confirm) {
          planRepo.delete(planId);
          var remaining = self.data.customerPlans.filter(function (p) { return p.id !== planId; });
          self.setData({ customerPlans: remaining });
          toast.success('已删除');
        }
      }
    });
  },

  // ---- 删除客户 ----

  onDeleteTap: function () {    var self = this;
    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复，关联的计划和记录也会一并删除。',
      confirmColor: '#EF4444',
      success: function (res) {
        if (res.confirm) {
          customerRepo.delete(self.data.id);
          toast.success('已删除');
          setTimeout(function () { wx.navigateBack(); }, 1000);
        }
      }
    });
  }
});

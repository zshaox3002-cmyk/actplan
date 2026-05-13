/**
 * customer-detail/index.js — 客户跟进工作台
 *
 * v1.1：5 Tab → 4 Tab（下线"需求 Tab"，合并入画像 Tab 的"保障状态"区块）
 * 画像 Tab 新增：保单价值组、保单区块、保障状态组、扩展字段组
 */

var customerRepo = require('../../utils/repository/customer.repo');
var policyRepo = require('../../utils/repository/policy.repo');
var insuredMemberRepo = require('../../utils/repository/insured-member.repo');
var recordRepo = require('../../utils/repository/record.repo');
var planRepo = require('../../utils/repository/plan.repo');
var objectionRepo = require('../../utils/repository/objection.repo');
var logRepo = require('../../utils/repository/log.repo');
var referralRepo = require('../../utils/repository/referral.repo');
var storage = require('../../utils/storage');
var priority = require('../../utils/priority');
var toast = require('../../utils/toast');
var dateUtil = require('../../utils/date');
var constants = require('../../utils/constants');
var templates = require('../../utils/policy-templates');

var STAGE_OPTIONS = ['初步认识', '需求沟通', '方案讲解', '待促成', '已成交', '已流失'];

var STAGE_CLASS_MAP = {
  '初步认识': 'meet',
  '需求沟通': 'comm',
  '方案讲解': 'present',
  '待促成':   'closing',
  '已成交':   'deal',
  '已流失':   'lost'
};


function findIndex(options, value) {
  if (value == null) return -1;
  return options.indexOf(value);
}

function getValue(options, index) {
  return index >= 0 ? options[index] : null;
}

/** 金额格式化：>= 10000 转万，保留一位小数（末尾 .0 省略） */
function fmtWan(n) {
  if (n >= 10000) {
    var wan = n / 10000;
    return (wan % 1 === 0 ? wan.toString() : wan.toFixed(1).replace(/\.0$/, ''));
  }
  return n.toString();
}
function fmtWanUnit(n) { return n >= 10000 ? '万元' : '元'; }

/**
 * @param {string} expireDate - YYYY-MM-DD
 * @returns {'' | 'expiring' | 'expired'}
 */
function computeExpiryStatus(expireDate) {
  if (!expireDate) return '';
  var today = dateUtil.today();
  if (expireDate < today) return 'expired';
  var diff = Math.round((new Date(expireDate) - new Date(today)) / 86400000);
  return diff <= 90 ? 'expiring' : '';
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
    activeTab: 'profile', // profile / policy / timeline / objection / plan

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

    // 转介绍来源选择
    referralSourceCustomerId: null,
    referralSourceCustomerName: '',
    showReferralPicker: false,
    referralCandidateList: [],

    // 沟通 Tab
    timeline: [],
    timelineVisible: [],
    timelineTotal: 0,
    timelineExpanded: false,
    showRecordEditSheet: false,
    recordEditId: null,
    recordEditSummary: '',

    // 异议 Tab
    customerObjections: [],
    showObjSheet: false,
    objSheetList: [],

    // 画像 Tab — 保单与保障状态（v1.1）
    policies: [],
    derived: { policy_count: 0, total_premium: 0, avg_premium: 0, first_policy_date: '' },
    coverageStatusList: [],
    coverageByMember: [],
    unconfirmedPolicyCount: 0,
    referralCount: 0,
    showHistoryBackfillTip: false,
    historyDealCount: 0,

    // 计划 Tab
    customerPlans: [],

    // 标签输入
    tagInput: '',
    presetTags: ['高净值', '企业主', '转介绍达人'],
    presetTagActive: {},

    // 添加计划底部 sheet
    showPlanSheet: false,
    planSheetMode: 'add',   // 'add' | 'edit'
    planSheetPlanId: null,
    planSheetDate: '',
    planSheetTime: '',
    planSheetVisitWay: '面对面',
    planSheetVisitWayOptions: [],

    // 保存防重复
    isSaving: false
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
    var customer = customerRepo.getCustomerWithDerived(id);

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

    // 保单列表（附带运行时计算字段）
    var rawPolicies = policyRepo.listWithComputed(id);

    // 确保有默认本人保障对象（老客户补全）
    insuredMemberRepo.ensureDefaultMember(id, customer.name);
    var insuredMembers = insuredMemberRepo.listByCustomer(id);
    var memberMap = {};
    for (var mi = 0; mi < insuredMembers.length; mi++) {
      memberMap[insuredMembers[mi].id] = insuredMembers[mi].display_name;
    }

    var policies = rawPolicies.map(function (p) {
      var memberId = p.insured_member_id !== undefined ? p.insured_member_id : null;
      return {
        id: p.id,
        productType: p.product_type,
        productName: p.product_name || '',
        category: p._category,
        premium: p.premium,
        effectiveDate: p.effective_date || '',
        policySummary: p._policy_summary,
        cardStatus: p._card_status.status,
        cardStatusLabel: p._card_status.label,
        cardDaysText: p._card_status.daysText,
        cardEventDate: p._card_status.eventDate,
        cardColorClass: p._card_status.colorClass,
        policyYear: p._policy_year,
        needsCompletion: p._needs_completion,
        insuredMemberId: memberId,
        insuredMemberName: memberId !== null
          ? (memberMap[memberId] || '未知')
          : '待确认'
      };
    });

    var unconfirmedPolicyCount = 0;
    for (var ui = 0; ui < policies.length; ui++) {
      if (policies[ui].insuredMemberId === null) unconfirmedPolicyCount++;
    }

    // 按保障对象分组计算保障状态（实时从 policy 表计算）
    var COVERAGE_KEYS = ['重疾', '医疗', '教育金', '养老', '意外', '寿险'];
    var memberCoverage = {};
    for (var pi = 0; pi < rawPolicies.length; pi++) {
      var pol = rawPolicies[pi];
      if (pol.insured_member_id === null || pol.insured_member_id === undefined) continue;
      if (pol.status !== 'active') continue;
      var mid = pol.insured_member_id;
      if (!memberCoverage[mid]) memberCoverage[mid] = {};
      var coverageKey = templates.getCoverageKey(pol._category || pol.category || '');
      if (coverageKey) memberCoverage[mid][coverageKey] = true;
    }
    var coverageByMember = insuredMembers.map(function (m) {
      var covered = memberCoverage[m.id] || {};
      var chips = [];
      for (var ki = 0; ki < COVERAGE_KEYS.length; ki++) {
        if (covered[COVERAGE_KEYS[ki]]) chips.push({ key: COVERAGE_KEYS[ki] });
      }
      return {
        memberId: m.id,
        memberName: m.display_name,
        relation: m.relation,
        chips: chips,
        hasAny: chips.length > 0
      };
    }).filter(function (m) { return m.hasAny; });

    // 历史成交补录提示
    var historyDealCount = records.filter(function (r) {
      return r.is_deal === '签单成交' && (!r.deal_products || r.deal_products.length === 0);
    }).length;
    var showHistoryBackfillTip = historyDealCount > 0 && policies.length === 0;

    wx.disableAlertBeforeUnload();

    var initData = {
      loading: false,
      isNew: false,
      isEditProfile: false,
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
      policies: policies,
      derived: {
        policy_count: customer.policy_count || 0,
        total_premium: customer.total_premium || 0,
        yearly_pending_premium: customer.yearly_pending_premium || 0,
        first_policy_date: customer.first_policy_date || '',
        total_premium_display: fmtWan(customer.total_premium || 0),
        total_premium_unit: fmtWanUnit(customer.total_premium || 0),
        yearly_pending_display: fmtWan(customer.yearly_pending_premium || 0),
        yearly_pending_unit: fmtWanUnit(customer.yearly_pending_premium || 0)
      },
      coverageByMember: coverageByMember,
      unconfirmedPolicyCount: unconfirmedPolicyCount,
      referralCount: customer.referral_count || 0,
      showHistoryBackfillTip: showHistoryBackfillTip,
      historyDealCount: historyDealCount
    };

    // 加载转介绍来源客户名称
    var referralSourceId = customer.referral_source_customer_id || null;
    var referralSourceName = '';
    if (referralSourceId !== null) {
      var sourceCustomer = customerRepo.get(referralSourceId);
      referralSourceName = sourceCustomer ? sourceCustomer.name : '';
    }
    initData.referralSourceCustomerId = referralSourceId;
    initData.referralSourceCustomerName = referralSourceName;

    // 计算预设标签激活状态
    var tags = customer.tags || [];
    var presetTagActive = {};
    var presetTags = this.data.presetTags;
    for (var pi = 0; pi < presetTags.length; pi++) {
      presetTagActive[presetTags[pi]] = tags.indexOf(presetTags[pi]) !== -1;
    }
    initData.presetTagActive = presetTagActive;

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
    if (this.data.isNew) {
      toast.fail('请先保存客户信息');
      return;
    }
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
    if (this.data.isSaving) return;
    this.setData({ isSaving: true });

    var d = this.data;
    try {
      if (d.planSheetMode === 'edit') {
        planRepo.update(d.planSheetPlanId, {
          plan_date: d.planSheetDate,
          plan_time: d.planSheetTime || null,
          visit_way: d.planSheetVisitWay
        });
        toast.success('已保存');
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
          return;
        }
        toast.success('添加成功');
      }
      var allPlans = planRepo.listAll();
      var id = this.data.id;
      var customerPlans = allPlans.filter(function (p) {
        return p.customer_id === id && p.status === '待执行';
      }).map(function (p) {
        var td = new Date(); var ts = td.getFullYear() + '-' + String(td.getMonth()+1).padStart(2,'0') + '-' + String(td.getDate()).padStart(2,'0');
        return Object.assign({}, p, { isOverdue: p.plan_date < ts });
      });
      this.setData({ showPlanSheet: false, customerPlans: customerPlans });
    } catch (e) {
      toast.fail('操作失败：' + e.message);
    } finally {
      this.setData({ isSaving: false });
    }
  },

  /** +记录：跳转 record-new（adhoc 模式） */
  onAddRecord: function () {
    if (this.data.isNew) {
      toast.fail('请先保存客户信息');
      return;
    }
    if (this._navigating) return;
    this._navigating = true;
    var self = this;
    wx.navigateTo({
      url: '/pages/record-new/index?customer_id=' + this.data.id +
           '&customer_name=' + encodeURIComponent(this.data.customerName) +
           '&record_type=adhoc',
      complete: function () { self._navigating = false; }
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
  onRelationChange:   function (e) {
    var newIndex = e.detail.value;
    var update = { relationIndex: newIndex };
    // 离开"客户介绍"时清空介绍人
    if (newIndex !== 5) {
      update.referralSourceCustomerId = null;
      update.referralSourceCustomerName = '';
    }
    this.setData(update);
  },
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
    var presetTagActive = Object.assign({}, this.data.presetTagActive);
    var removed = this.data.tags[idx];
    if (removed !== undefined) presetTagActive[removed] = false;
    this.setData({ tags: tags, presetTagActive: presetTagActive });
  },

  /** 点击预设标签：已选则移除，未选则添加 */
  onPresetTagTap: function(e) {
    var tag = e.currentTarget.dataset.tag;
    var tags = this.data.tags.slice();
    var presetTagActive = Object.assign({}, this.data.presetTagActive);
    var idx = tags.indexOf(tag);
    if (idx === -1) {
      tags.push(tag);
      presetTagActive[tag] = true;
    } else {
      tags.splice(idx, 1);
      presetTagActive[tag] = false;
    }
    this.setData({ tags: tags, presetTagActive: presetTagActive });
  },

  /** 保存画像 */
  onSaveProfile: function () {
    if (this.data.isSaving) return;
    this.setData({ isSaving: true });

    var form = this.data.form;
    if (!form.name || !form.name.trim()) {
      toast.fail('请输入客户姓名');
      this.setData({ isSaving: false });
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
        // 选了"客户介绍"但未选介绍人，拦截
        if (customerData.relation === '客户介绍' && this.data.referralSourceCustomerId === null) {
          toast.fail('请选择介绍人');
          this.setData({ isSaving: false });
          wx.enableAlertBeforeUnload({ message: '当前有未保存的修改，确认放弃？' });
          return;
        }
        var created = customerRepo.createWithReferral(customerData, this.data.referralSourceCustomerId);
        // 立即翻转状态，防止 setTimeout 期间重复点击再次触发 create
        this.setData({ isNew: false, id: created.id });
        toast.success('创建成功');
        setTimeout(function () { wx.navigateBack(); }, 1000);
      } else {
        customerRepo.update(this.data.id, customerData);

        // 若转介绍来源有变化则同步更新
        var originalReferralId = this.data.referralSourceCustomerId;
        var existingRelation = referralRepo.getByReferred(this.data.id);
        var storedReferralId = existingRelation ? existingRelation.referrer_customer_id : null;
        if (originalReferralId !== storedReferralId) {
          var result = customerRepo.updateReferralSource(this.data.id, originalReferralId);
          if (!result.ok) {
            toast.fail(result.error || '转介绍来源更新失败');
            this.setData({ isSaving: false });
            return;
          }
        }

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
    } finally {
      this.setData({ isSaving: false });
    }
  },

  // ---- 沟通 Tab ----

  /** 展开全部沟通记录 */
  onExpandTimeline: function () {
    this.setData({ timelineExpanded: true, timelineVisible: this.data.timeline });
  },

  /** 打开摘要编辑 sheet */
  onEditRecordTap: function (e) {
    var recordId = parseInt(e.currentTarget.dataset.id);
    var record = null;
    var list = this.data.timeline;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === recordId) { record = list[i]; break; }
    }
    if (!record) return;
    this.setData({
      showRecordEditSheet: true,
      recordEditId: recordId,
      recordEditSummary: record.summary
    });
  },

  onRecordEditSummaryInput: function (e) {
    this.setData({ recordEditSummary: e.detail.value });
  },

  onRecordEditCancel: function () {
    this.setData({ showRecordEditSheet: false, recordEditId: null, recordEditSummary: '' });
  },

  onRecordEditConfirm: function () {
    if (this.data.isSaving) return;
    this.setData({ isSaving: true });
    try {
      recordRepo.update(this.data.recordEditId, { summary: this.data.recordEditSummary });
      // 同步更新本地 timeline
      var update = function (list) {
        return list.map(function (r) {
          return r.id === this.data.recordEditId
            ? Object.assign({}, r, { summary: this.data.recordEditSummary })
            : r;
        }.bind(this));
      }.bind(this);
      var newTimeline = update(this.data.timeline);
      var newVisible = update(this.data.timelineVisible);
      this.setData({
        timeline: newTimeline,
        timelineVisible: newVisible,
        showRecordEditSheet: false,
        recordEditId: null,
        recordEditSummary: ''
      });
      toast.success('已保存');
    } catch (e) {
      toast.fail('保存失败：' + e.message);
    } finally {
      this.setData({ isSaving: false });
    }
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
    if (this._navigating) return;
    this._navigating = true;
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
      },
      complete: function () { that._navigating = false; }
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

  // ---- 画像 Tab — 保单与保障状态 ----

  /** 跳转 policy-edit 新建保单 */
  onAddPolicy: function () {
    if (this._navigating) return;
    this._navigating = true;
    var self = this;
    wx.navigateTo({
      url: '/pages/policy-edit/index?customer_id=' + this.data.id,
      complete: function () { self._navigating = false; }
    });
  },

  /** 保单卡片操作菜单（编辑/标记断保/删除） */
  onPolicyAction: function (e) {
    var policyId = parseInt(e.currentTarget.dataset.id);
    var self = this;
    wx.showActionSheet({
      itemList: ['编辑', '标记断保', '删除'],
      success: function (res) {
        if (res.tapIndex === 0) {
          wx.navigateTo({
            url: '/pages/policy-edit/index?customer_id=' + self.data.id + '&policy_id=' + policyId
          });
        } else if (res.tapIndex === 1) {
          policyRepo.update(policyId, { status: 'expired' });
          self._loadDetail(self.data.id);
          toast.success('已标记断保');
        } else if (res.tapIndex === 2) {
          self._deletePolicy(policyId);
        }
      }
    });
  },

  /** 删除保单 */
  _deletePolicy: function (policyId) {
    var self = this;
    var doDelete = function () {
      var result = policyRepo.remove(policyId);
      if (!result.success) return;
      self._loadDetail(self.data.id);
      toast.success('已删除');
    };
    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复。',
      confirmColor: '#EF4444',
      success: function (res) { if (res.confirm) doDelete(); }
    });
  },

  /** 保障状态 Chip 点击：configured 不可点，其余循环 unknown→gap→none→unknown */
  onCoverageStatusChange: function (e) {
    var key = e.currentTarget.dataset.key;
    var list = this.data.coverageStatusList;
    var current = null;
    for (var i = 0; i < list.length; i++) {
      if (list[i].key === key) { current = list[i]; break; }
    }
    if (!current || current.value === 'configured') return;
    var cycle = { unknown: 'gap', gap: 'none', none: 'unknown' };
    var newVal = cycle[current.value] || 'unknown';
    var statusUpdate = {};
    statusUpdate[key] = newVal;
    try {
      customerRepo.update(this.data.id, { coverage_status: statusUpdate });
      var newList = list.map(function (it) {
        return it.key === key ? { key: it.key, value: newVal } : it;
      });
      this.setData({ coverageStatusList: newList });
    } catch (err) {
      toast.fail('更新失败');
    }
  },

  // ---- 转介绍来源操作 ----

  /** 打开介绍人选择器 */
  onSelectReferralTap: function() {
    var self = this;
    var currentId = this.data.id; // 新建时为 null
    var allCustomers = customerRepo.list({});
    var candidates = allCustomers.filter(function(c) {
      return c.id !== currentId; // 排除自身（新建时 currentId 为 null，不会误过滤）
    }).map(function(c) {
      return { id: c.id, name: c.name, stage: c.stage };
    });
    this.setData({ showReferralPicker: true, referralCandidateList: candidates });
  },

  /** 选中介绍人 */
  onReferralCustomerSelect: function(e) {
    var idx = parseInt(e.currentTarget.dataset.index);
    var candidate = this.data.referralCandidateList[idx];
    if (!candidate) return;
    // 循环检查（仅编辑已有客户时才需要，新建时客户还不存在，无循环风险）
    if (this.data.id !== null && referralRepo.isCircular(candidate.id, this.data.id)) {
      toast.fail('不能选择下游客户作为介绍人');
      return;
    }
    this.setData({
      referralSourceCustomerId: candidate.id,
      referralSourceCustomerName: candidate.name,
      showReferralPicker: false
    });
  },

  /** 关闭介绍人选择器（不选） */
  onReferralPickerClose: function() {
    this.setData({ showReferralPicker: false });
  },

  /** 清空介绍人 */
  onClearReferralSource: function() {
    this.setData({ referralSourceCustomerId: null, referralSourceCustomerName: '' });
  },

  /** 跳转到转介绍来源客户详情 */
  onJumpToReferralSource: function() {
    var id = this.data.referralSourceCustomerId;
    if (id === null) return;
    wx.navigateTo({ url: '/pages/customer-detail/index?id=' + id });
  },

  /** 跳转到转介绍网络页 */
  onViewReferralNetwork: function() {
    wx.navigateTo({ url: '/pages/referral-network/index?id=' + this.data.id });
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

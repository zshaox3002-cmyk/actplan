/**
 * customer/index.js — 客户跟进池
 * v1.1：视图切换器替换原优先级/阶段 Chip 筛选区
 * 选中"全部"时行为与 v1.0 完全一致（P0–P3 排序）
 */

var customerRepo = require('../../utils/repository/customer.repo');
var planRepo = require('../../utils/repository/plan.repo');
var recordRepo = require('../../utils/repository/record.repo');
var policyRepo = require('../../utils/repository/policy.repo');
var referralRepo = require('../../utils/repository/referral.repo');
var segmentRepo = require('../../utils/repository/segment.repo');
var priority = require('../../utils/priority');
var segment = require('../../utils/segment');
var reviewStats = require('../../utils/review-stats');
var storage = require('../../utils/storage');
var toast = require('../../utils/toast');
var dateUtil = require('../../utils/date');
var constants = require('../../utils/constants');

var STAGE_OPTIONS = ['全部', '初步认识', '需求沟通', '方案讲解', '待促成', '已成交', '已流失'];

Page({
  data: {
    pageState: 'loading',
    customers: [],
    keyword: '',
    missingReferrerCustomers: [],

    // 视图切换器（v1.1）
    segments: [],           // [{ id, name, color, is_system }, ...]，首位为硬编码"全部"
    activeSegmentId: null,  // null = 全部
    segmentCounts: {},      // { [segmentId]: count }
    addSegmentDisabled: false,

    // 添加计划底部 sheet
    showPlanSheet: false,
    planSheetCustomerId: null,
    planSheetCustomerName: '',
    planSheetDate: '',
    planSheetTime: '',
    planSheetVisitWay: '面对面',
    planSheetGoal: '',
    visitWayOptions: ['面对面', '电话', '微信'],

    // 视图上下文（供 customer-card 差异化展示）
    activeViewContext: 'default',

    // 保存防重复
    isSaving: false
  },

  /** 缓存富化后的全量客户列表，用于视图切换时快速过滤 */
  _enrichedAll: null,

  onLoad: function () {
    this._safeLoad();
  },

  onShow: function () {
    this._safeLoad();
  },

  _safeLoad: function () {
    var that = this;
    if (storage.isReady()) {
      that._loadList();
    } else {
      storage.waitReady().then(function () { that._loadList(); });
    }
  },

  _loadList: function () {
    try {
      var allCustomers = customerRepo.list({ keyword: this.data.keyword });
      var allPlans = planRepo.listAll();
      var allRecords = recordRepo.list();
      var allObjNotes = storage.getTable('objection_note');

      // 批量获取派生字段（一次读取 db_policy，避免 N 次循环）
      var derivedMap = policyRepo.getDerivedAll();

      var todayStr = dateUtil.today();

      // 使用 enrichCustomers 添加节奏相关派生字段
      var enrichedBase = reviewStats.enrichCustomers(allCustomers, allRecords, allPlans, allObjNotes, todayStr);

      // 追加 UI 专用字段（优先级、下次跟进文案等）
      var enriched = enrichedBase.map(function (c) {
        // 找最近待执行计划（用于优先级计算和文案）
        var nextPlan = null;
        for (var i = 0; i < allPlans.length; i++) {
          var p = allPlans[i];
          if (p.customer_id === c.id && p.status === '待执行') {
            if (!nextPlan || p.plan_date < nextPlan.plan_date) nextPlan = p;
          }
        }

        var lastSummary = '';
        for (var j = 0; j < allRecords.length; j++) {
          if (allRecords[j].customer_id === c.id) {
            lastSummary = allRecords[j].summary || '';
            break;
          }
        }

        var pri = priority.calculatePriority(c, nextPlan);

        var nextFollowText = '未安排';
        var isOverdue = false;
        if (nextPlan) {
          if (nextPlan.plan_date < todayStr) {
            isOverdue = true;
            var diff = Math.round((new Date(todayStr) - new Date(nextPlan.plan_date)) / 86400000);
            nextFollowText = '已逾期' + diff + '天';
          } else if (nextPlan.plan_date === todayStr) {
            nextFollowText = '今天';
          } else {
            nextFollowText = nextPlan.plan_date.slice(5).replace('-', '/');
            if (nextPlan.plan_time) nextFollowText += ' ' + nextPlan.plan_time;
          }
        }

        var lastVisitText = '暂无';
        if (c.last_visit) {
          var days = Math.round((new Date(todayStr) - new Date(c.last_visit)) / 86400000);
          if (days === 0) lastVisitText = '今天';
          else if (days === 1) lastVisitText = '昨天';
          else lastVisitText = days + '天前';
        }

        // 合并保单派生字段
        var derived = derivedMap[c.id] || { policy_count: 0, total_premium: 0, avg_premium: 0, first_policy_date: null };

        return Object.assign({}, c, derived, {
          _priority: pri,
          _priorityLevel: pri ? pri.level : '',
          _priorityLabel: pri ? pri.label : '',
          _priorityReasons: pri && pri.reasons ? pri.reasons.join(' · ') : '',
          _nextFollowText: nextFollowText,
          _nextFollowDate: nextPlan ? nextPlan.plan_date : null,
          _isOverdue: isOverdue,
          _lastVisitText: lastVisitText,
          _lastSummary: lastSummary ? lastSummary.slice(0, 30) + (lastSummary.length > 30 ? '…' : '') : ''
        });
      });

      this._enrichedAll = enriched;

      // 加载视图列表并计算命中数
      var allSegments = segmentRepo.listAll();
      var segmentCounts = {};
      for (var s = 0; s < allSegments.length; s++) {
        var seg = allSegments[s];
        var matched = segment.applySegment(enriched, seg.rules, null);
        segmentCounts[seg.id] = matched.length;
      }

      this.setData({
        segments: allSegments,
        segmentCounts: segmentCounts,
        addSegmentDisabled: segmentRepo.getUserCount() >= segmentRepo.MAX_USER_SEGMENTS
      });

      // 计算关系来源为「客户介绍」但未填写介绍人的客户
      var missing = [];
      for (var mi = 0; mi < allCustomers.length; mi++) {
        var mc = allCustomers[mi];
        if (mc.relation === '客户介绍' && !referralRepo.getByReferred(mc.id)) {
          missing.push({ id: mc.id, name: mc.name });
        }
      }
      this.setData({ missingReferrerCustomers: missing });

      this._applySegmentFilter();
    } catch (e) {
      this.setData({ pageState: 'error' });
      toast.fail('加载失败');
    }
  },

  /** 根据当前选中视图过滤并排序客户列表 */
  _applySegmentFilter: function () {
    var enriched = this._enrichedAll || [];
    var activeId = this.data.activeSegmentId;
    var filtered;
    var activeViewContext = 'default';

    if (activeId === null) {
      // 全部：P0→P1→P2→P3→已成交→已流失，同级按 score 降序
      filtered = enriched.slice();
      filtered.sort(function (a, b) {
        var order = { P0: 0, P1: 1, P2: 2, P3: 3 };
        var aOrder = a._priority ? (order[a._priorityLevel] !== undefined ? order[a._priorityLevel] : 4) : 5;
        var bOrder = b._priority ? (order[b._priorityLevel] !== undefined ? order[b._priorityLevel] : 4) : 5;
        if (aOrder !== bOrder) return aOrder - bOrder;
        var aScore = a._priority ? a._priority.score : 0;
        var bScore = b._priority ? b._priority.score : 0;
        return bScore - aScore;
      });
    } else {
      // 找到对应视图规则
      var allSegments = this.data.segments;
      var activeSeg = null;
      for (var i = 0; i < allSegments.length; i++) {
        if (allSegments[i].id === activeId) { activeSeg = allSegments[i]; break; }
      }
      if (activeSeg) {
        filtered = segment.applySegment(enriched, activeSeg.rules, activeSeg.sort);
        // 节奏预设视图上下文
        if (activeSeg.rhythm_preset === 'attention') activeViewContext = 'rhythm_attention';
        else if (activeSeg.rhythm_preset === 'advancing') activeViewContext = 'rhythm_advancing';
      } else {
        filtered = enriched.slice();
      }
    }

    this.setData({
      customers: filtered,
      activeViewContext: activeViewContext,
      pageState: filtered.length === 0 ? 'empty' : 'data'
    });
  },

  /**
   * 点击缺失介绍人的客户名，跳转到详情页补填
   * @param {Object} e
   */
  onMissingReferrerTap: function (e) {
    var id = parseInt(e.currentTarget.dataset.id);
    wx.navigateTo({ url: '/pages/customer-detail/index?id=' + id });
  },

  onSearchInput: function (e) {
    this.setData({ keyword: e.detail.value });
    this._loadList();
  },

  onSearchClear: function () {
    this.setData({ keyword: '' });
    this._loadList();
  },

  /** 视图 Chip 点击 */
  onSegmentTap: function (e) {
    var id = e.currentTarget.dataset.id;
    // null 表示"全部"
    var newId = (id === null || id === undefined || id === '') ? null : parseInt(id);
    this.setData({ activeSegmentId: newId });
    this._applySegmentFilter();
  },

  /** 视图 Chip 长按：弹出编辑/删除菜单 */
  onSegmentLongPress: function (e) {
    var id = parseInt(e.currentTarget.dataset.id);
    var isSystem = e.currentTarget.dataset.isSystem;
    var that = this;

    var items = isSystem ? ['查看规则'] : ['编辑', '删除'];
    wx.showActionSheet({
      itemList: items,
      success: function (res) {
        if (isSystem || res.tapIndex === 0) {
          wx.navigateTo({ url: '/pages/segment-edit/index?id=' + id });
        } else if (res.tapIndex === 1) {
          // 删除
          wx.showModal({
            title: '删除视图',
            content: '确认删除该视图？',
            success: function (modal) {
              if (modal.confirm) {
                try {
                  segmentRepo.remove(id);
                  toast.success('已删除');
                  that._loadList();
                } catch (err) {
                  toast.fail(err.message || '删除失败');
                }
              }
            }
          });
        }
      }
    });
  },

  /** 新建视图 */
  onAddSegment: function () {
    if (this.data.addSegmentDisabled) {
      wx.showToast({ title: '自建视图已达上限（10个）', icon: 'none' });
      return;
    }
    if (this._navigating) return;
    this._navigating = true;
    var self = this;
    wx.navigateTo({
      url: '/pages/segment-edit/index',
      complete: function () { self._navigating = false; }
    });
  },

  onCustomerTap: function (e) {
    wx.navigateTo({ url: '/pages/customer-detail/index?id=' + e.detail.id });
  },

  onCustomerDelete: function (e) {
    var id = parseInt(e.detail.id);
    try {
      customerRepo.delete(id);
      toast.success('已删除');
      this._loadList();
    } catch (err) {
      toast.fail('删除失败');
    }
  },

  onAddPlan: function (e) {
    var id = e.detail.id;
    var name = e.detail.name;
    this.setData({
      showPlanSheet: true,
      planSheetCustomerId: id,
      planSheetCustomerName: name,
      planSheetDate: dateUtil.today(),
      planSheetTime: '',
      planSheetVisitWay: '面对面',
      planSheetGoal: ''
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

  onPlanSheetClearTime: function () {
    this.setData({ planSheetTime: '' });
  },

  onPlanSheetCancel: function () {
    this.setData({ showPlanSheet: false });
  },

  onPlanSheetWayChange: function (e) {
    this.setData({ planSheetVisitWay: e.currentTarget.dataset.way });
  },

  onPlanSheetGoalInput: function (e) {
    this.setData({ planSheetGoal: e.detail.value });
  },

  onPlanSheetConfirm: function () {
    if (this.data.isSaving) return;
    this.setData({ isSaving: true });

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
    toast.success('添加成功');
    this.setData({ showPlanSheet: false });
    this._loadList();
    this.setData({ isSaving: false });
  },

  onAddRecord: function (e) {
    var id = e.detail.id;
    var name = e.detail.name;
    wx.navigateTo({
      url: '/pages/record-new/index?customer_id=' + id +
           '&customer_name=' + encodeURIComponent(name) +
           '&record_type=adhoc'
    });
  },

  onPageTap: function () {
    var cards = this.selectAllComponents('.customer-card-component');
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].closeSwipe) cards[i].closeSwipe();
    }
  },

  onAddCustomer: function () {
    wx.navigateTo({ url: '/pages/customer-detail/index' });
  },

  onDataManage: function () {
    wx.navigateTo({ url: '/pages/data-manage/index' });
  }
});

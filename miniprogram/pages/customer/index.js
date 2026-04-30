/**
 * customer/index.js — 客户跟进池
 * 按 P0-P3 优先级排序，支持优先级/阶段筛选，卡片含 +计划/+记录 快捷操作
 */

var customerRepo = require('../../utils/repository/customer.repo');
var planRepo = require('../../utils/repository/plan.repo');
var recordRepo = require('../../utils/repository/record.repo');
var priority = require('../../utils/priority');
var storage = require('../../utils/storage');
var toast = require('../../utils/toast');
var dateUtil = require('../../utils/date');
var constants = require('../../utils/constants');

var STAGE_OPTIONS = ['全部', '初步认识', '需求沟通', '方案讲解', '待促成', '已成交', '已流失'];
var STAGE_CHIPS = ['需求沟通', '方案讲解', '待促成', '已成交'];

Page({
  data: {
    pageState: 'loading',
    customers: [],
    keyword: '',
    priorityFilter: '全部',
    stageFilter: '全部',
    stageOptions: STAGE_OPTIONS,
    stageChips: STAGE_CHIPS,
    chipCounts: { P0: 0, P1: 0, P2: 0, overdue: 0 },

    // 添加计划底部 sheet
    showPlanSheet: false,
    planSheetCustomerId: null,
    planSheetCustomerName: '',
    planSheetDate: '',
    planSheetTime: '',
    planSheetVisitWay: '面对面',
    planSheetVisitWayOptions: []
  },

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

      var today = new Date();
      var todayStr = today.getFullYear() + '-' +
        String(today.getMonth() + 1).padStart(2, '0') + '-' +
        String(today.getDate()).padStart(2, '0');

      // 为每个客户计算优先级、下次计划、最近摘要
      var enriched = allCustomers.map(function (c) {
        // 找最近一条待执行计划
        var nextPlan = null;
        for (var i = 0; i < allPlans.length; i++) {
          var p = allPlans[i];
          if (p.customer_id === c.id && p.status === '待执行') {
            if (!nextPlan || p.plan_date < nextPlan.plan_date) nextPlan = p;
          }
        }

        // 最近一条拜访记录摘要
        var lastSummary = '';
        for (var j = 0; j < allRecords.length; j++) {
          if (allRecords[j].customer_id === c.id) {
            lastSummary = allRecords[j].summary || '';
            break;
          }
        }

        var pri = priority.calculatePriority(c, nextPlan);

        // 下次跟进展示
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

        // 上次沟通展示
        var lastVisitText = '暂无';
        if (c.last_visit) {
          var days = Math.round((new Date(todayStr) - new Date(c.last_visit)) / 86400000);
          if (days === 0) lastVisitText = '今天';
          else if (days === 1) lastVisitText = '昨天';
          else lastVisitText = days + '天前';
        }

        return Object.assign({}, c, {
          _priority: pri,
          _priorityLevel: pri ? pri.level : '',
          _priorityLabel: pri ? pri.label : '',
          _priorityReasons: pri && pri.reasons ? pri.reasons.join(' · ') : '',
          _nextFollowText: nextFollowText,
          _isOverdue: isOverdue,
          _lastVisitText: lastVisitText,
          _lastSummary: lastSummary ? lastSummary.slice(0, 30) + (lastSummary.length > 30 ? '…' : '') : ''
        });
      });

      // 计算 Chip 计数
      var counts = { P0: 0, P1: 0, P2: 0, overdue: 0 };
      enriched.forEach(function (c) {
        if (c._priorityLevel === 'P0') counts.P0++;
        if (c._priorityLevel === 'P1') counts.P1++;
        if (c._priorityLevel === 'P2') counts.P2++;
        if (c._isOverdue) counts.overdue++;
      });

      // 筛选
      var pf = this.data.priorityFilter;
      var sf = this.data.stageFilter;
      var filtered = enriched.filter(function (c) {
        if (pf === 'P0' && c._priorityLevel !== 'P0') return false;
        if (pf === 'P1' && c._priorityLevel !== 'P1') return false;
        if (pf === 'P2' && c._priorityLevel !== 'P2') return false;
        if (pf === 'P3' && c._priorityLevel !== 'P3') return false;
        if (pf === '逾期' && !c._isOverdue) return false;
        if (sf !== '全部' && c.stage !== sf) return false;
        return true;
      });

      // 排序：P0→P1→P2→P3→已成交→已流失，同级按 score 降序
      filtered.sort(function (a, b) {
        var order = { P0: 0, P1: 1, P2: 2, P3: 3 };
        var aOrder = a._priority ? (order[a._priorityLevel] !== undefined ? order[a._priorityLevel] : 4) : 5;
        var bOrder = b._priority ? (order[b._priorityLevel] !== undefined ? order[b._priorityLevel] : 4) : 5;
        if (aOrder !== bOrder) return aOrder - bOrder;
        var aScore = a._priority ? a._priority.score : 0;
        var bScore = b._priority ? b._priority.score : 0;
        return bScore - aScore;
      });

      this.setData({
        customers: filtered,
        chipCounts: counts,
        pageState: filtered.length === 0 ? 'empty' : 'data'
      });
    } catch (e) {
      this.setData({ pageState: 'error' });
      toast.fail('加载失败');
    }
  },

  onSearchInput: function (e) {
    this.setData({ keyword: e.detail.value });
    this._loadList();
  },

  onSearchClear: function () {
    this.setData({ keyword: '' });
    this._loadList();
  },

  onPriorityFilterTap: function (e) {
    var val = e.currentTarget.dataset.val;
    this.setData({ priorityFilter: val === this.data.priorityFilter ? '全部' : val });
    this._loadList();
  },

  onStageFilterTap: function (e) {
    var val = e.currentTarget.dataset.val;
    this.setData({ stageFilter: val === this.data.stageFilter ? '全部' : val });
    this._loadList();
  },

  onStageFilterChange: function (e) {
    var idx = parseInt(e.detail.value);
    this.setData({ stageFilter: STAGE_OPTIONS[idx] });
    this._loadList();
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
    if (!this.data.planSheetTime) {
      toast.fail('请选择计划时间');
      return;
    }
    var result = planRepo.create({
      customer_id: this.data.planSheetCustomerId,
      plan_date: this.data.planSheetDate,
      plan_time: this.data.planSheetTime,
      visit_way: this.data.planSheetVisitWay
    });
    if (result.conflict) {
      toast.fail('该客户当日已有计划');
    } else {
      toast.success('添加成功');
      this.setData({ showPlanSheet: false });
      this._loadList();
    }
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
  }
});

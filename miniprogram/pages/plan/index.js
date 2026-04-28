/**
 * plan/index.js — 拜访计划页
 * 功能：周/月视图日历 + 当日计划列表 + FAB 新建
 * 三态：loading(skeleton) / empty(empty-state) / data(list)
 */

var planRepo = require('../../utils/repository/plan.repo');
var customerRepo = require('../../utils/repository/customer.repo');
var recordRepo = require('../../utils/repository/record.repo');
var planDigest = require('../../utils/plan-digest');
var dateUtil = require('../../utils/date');
var storage = require('../../utils/storage');
var toast = require('../../utils/toast');

Page({
  data: {
    selectedDate: '',
    markedDates: [],
    plans: [],
    customerMap: {},
    pageState: 'loading',    // 'loading' | 'empty' | 'data'
    upcomingList: [],
    upcomingTotal: 0,
    overdueCount: 0,
    overdueList: [],
    overdueExpanded: false
  },

  onLoad: function () {
    var today = dateUtil.formatDate(new Date(), 'YYYY-MM-DD');
    this.setData({ selectedDate: today });
    this._safeLoad(today);
  },

  onShow: function () {
    if (this.data.selectedDate && this.data.pageState !== 'loading') {
      this._safeLoad(this.data.selectedDate);
    }
  },

  /** 等待 Storage 就绪后再加载 */
  _safeLoad: function (date) {
    var that = this;
    if (storage.isReady()) {
      that._loadData(date);
    } else {
      storage.waitReady().then(function () {
        that._loadData(date);
      });
    }
  },

  /**
   * 加载日历标记 + 当日计划
   * @param {string} date - 选中日期
   */
  _loadData: function (date) {
    try {
      // 使用全量计划提取 markedDates，确保月视图圆点也正确
      var allPlans = planRepo.listAll();
      var markedDates = [];
      var customerMap = {};

      for (var i = 0; i < allPlans.length; i++) {
        if (markedDates.indexOf(allPlans[i].plan_date) === -1) {
          markedDates.push(allPlans[i].plan_date);
        }
      }

      // 获取当日计划
      var todayPlans = planRepo.list(date);

      // 批量获取关联客户名
      for (var j = 0; j < todayPlans.length; j++) {
        var cid = todayPlans[j].customer_id;
        if (!customerMap[cid]) {
          var customer = customerRepo.get(cid);
          customerMap[cid] = customer ? customer.name : '未知客户';
        }
      }

      this.setData({
        markedDates: markedDates,
        plans: todayPlans,
        customerMap: customerMap,
        pageState: todayPlans.length === 0 ? 'empty' : 'data'
      });

      // 聚合：即将到期 + 逾期
      this._loadDigest(allPlans);
    } catch (e) {
      this.setData({ pageState: 'empty' });
      toast.fail('加载失败');
    }
  },

  /** 日历选中日期变化 */
  onDateSelect: function (e) {
    var date = e.detail.date;
    this.setData({ selectedDate: date });
    this._loadData(date);
  },

  /** 执行计划 → 跳转新建记录页 */
  onExecutePlan: function (e) {
    var plan = e.detail.plan;
    wx.navigateTo({
      url: '/pages/record-new/index?customer_id=' + plan.customer_id + '&plan_id=' + plan.id + '&plan_date=' + plan.plan_date + '&plan_time=' + (plan.plan_time || '') + '&visit_way=' + plan.visit_way,
      success: function (res) {
        res.eventChannel.emit('preloadPlan', { plan: plan });
      }
    });
  },

  /** 删除计划 */
  onDeletePlan: function (e) {
    var planId = e.detail.id;
    planRepo.delete(planId);
    this._loadData(this.data.selectedDate);
    toast.success('已删除');
  },

  /** 修改计划 → 跳转编辑页 */
  onEditPlan: function (e) {
    wx.navigateTo({
      url: '/pages/plan-select/index?planId=' + e.detail.id
    });
  },

  /** 已完成卡片点击 → 查看拜访记录详情 */
  onViewRecord: function (e) {
    var planId = e.detail.id;
    var allRecords = recordRepo.list();
    var record = null;
    for (var i = 0; i < allRecords.length; i++) {
      if (allRecords[i].plan_id === planId) {
        record = allRecords[i];
        break;
      }
    }
    if (record) {
      wx.navigateTo({ url: '/pages/visit-record/detail/index?id=' + record.id });
    } else {
      wx.showToast({ title: '暂无拜访记录', icon: 'none' });
    }
  },

  /** FAB 新建计划 → 跳转客户选择页 */
  onAddPlan: function () {
    wx.navigateTo({
      url: '/pages/plan-select/index?date=' + this.data.selectedDate
    });
  },

  /** 空状态操作按钮 */
  onEmptyAction: function () {
    wx.navigateTo({
      url: '/pages/plan-select/index?date=' + this.data.selectedDate
    });
  },

  /**
   * 加载即将到期 + 逾期聚合数据
   * @param {Array} [allPlans] - 可复用外部已取得的全量计划，避免重复查询
   */
  _loadDigest: function (allPlans) {
    if (!allPlans) {
      allPlans = planRepo.listAll();
    }
    var customers = customerRepo.list();
    var nameMap = {};
    for (var i = 0; i < customers.length; i++) {
      nameMap[customers[i].id] = customers[i].name;
    }

    var upcoming = planDigest.getUpcomingPlans(allPlans, 30);
    var overdue = planDigest.getOverduePlans(allPlans);

    var upcomingList = upcoming.map(function (p) {
      return Object.assign({}, p, { customer_name: nameMap[p.customer_id] || '(未知客户)' });
    });

    var overdueList = overdue.map(function (p) {
      return Object.assign({}, p, { customer_name: nameMap[p.customer_id] || '(未知客户)' });
    });

    this.setData({
      upcomingList: upcomingList,
      upcomingTotal: upcoming.length,
      overdueCount: overdue.length,
      overdueList: overdueList
    });
  },

  /** 点击即将到期的某一项：日历定位到该日期 */
  onTapUpcomingItem: function (e) {
    var id = parseInt(e.currentTarget.dataset.id);
    var item = null;
    for (var i = 0; i < this.data.upcomingList.length; i++) {
      if (this.data.upcomingList[i].id === id) {
        item = this.data.upcomingList[i];
        break;
      }
    }
    if (item && item.plan_date) {
      this.setData({ selectedDate: item.plan_date });
      this._loadData(item.plan_date);
    }
  },

  /** 点击逾期卡片：展开/收起逾期列表 */
  onViewOverdue: function () {
    this.setData({ overdueExpanded: !this.data.overdueExpanded });
  },

  /** 点击逾期列表中的某一项：日历定位到该日期 */
  onTapOverdueItem: function (e) {
    var id = parseInt(e.currentTarget.dataset.id);
    var item = null;
    for (var i = 0; i < this.data.overdueList.length; i++) {
      if (this.data.overdueList[i].id === id) {
        item = this.data.overdueList[i];
        break;
      }
    }
    if (item && item.plan_date) {
      this.setData({ selectedDate: item.plan_date, overdueExpanded: false });
      this._loadData(item.plan_date);
    }
  }
});

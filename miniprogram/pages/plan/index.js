/**
 * plan/index.js — 拜访计划页
 * 功能：周视图日历 + 当日计划列表 + FAB 新建
 * 三态：loading(skeleton) / empty(empty-state) / data(list)
 */

var planRepo = require('../../utils/repository/plan.repo');
var customerRepo = require('../../utils/repository/customer.repo');
var recordRepo = require('../../utils/repository/record.repo');
var dateUtil = require('../../utils/date');
var storage = require('../../utils/storage');
var toast = require('../../utils/toast');

Page({
  data: {
    selectedDate: '',
    markedDates: [],
    plans: [],
    customerMap: {},
    pageState: 'loading'    // 'loading' | 'empty' | 'data'
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
      // 获取本周有计划的日期
      var weekPlans = planRepo.listWeek(date);
      var markedDates = [];
      var customerMap = {};

      for (var i = 0; i < weekPlans.length; i++) {
        if (markedDates.indexOf(weekPlans[i].plan_date) === -1) {
          markedDates.push(weekPlans[i].plan_date);
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
      url: '/pages/record-new/index?customer_id=' + plan.customer_id + '&plan_id=' + plan.id + '&visit_way=' + plan.visit_way,
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

  /** 已完成卡片点击 → 查看拜访记录详情 */
  onViewRecord: function (e) {
    var planId = e.detail.id;
    // 通过 planId 查找关联的 visit_record
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
  }
});

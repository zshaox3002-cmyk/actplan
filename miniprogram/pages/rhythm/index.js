/**
 * rhythm/index.js — 客户节奏页
 * 将客户分为升温/降温/卡住三类，帮助代理人识别跨客户模式
 */

var storage = require('../../utils/storage');
var rhythm = require('../../utils/rhythm');
var dateUtil = require('../../utils/date');
var constants = require('../../utils/constants');

Page({
  data: {
    activeTab: 'warming',
    warmingList: [],
    coolingList: [],
    stuckList: [],
    warmingDelta: '0',
    coolingDelta: '0',
    stuckDelta: '0',
    loading: true
  },

  onLoad: function () {
    this._loadData();
  },

  onShow: function () {
    if (!this.data.loading) {
      this._loadData();
    }
  },

  _loadData: function () {
    var self = this;
    storage.waitReady().then(function () {
      var customers = storage.getTable('customer');
      var records = storage.getTable('visit_record');
      var today = dateUtil.today();

      var result = rhythm.classifyCustomers(customers, records, today);

      var warmingDelta = self._computeWeekDelta(result.warming, records, today);
      var coolingDelta = self._computeWeekDelta(result.cooling, records, today);
      var stuckDelta = self._computeWeekDelta(result.stuck, records, today);

      self.setData({
        warmingList: result.warming.map(function (item) { return self._toCardData(item); }),
        coolingList: result.cooling.map(function (item) { return self._toCardData(item); }),
        stuckList: result.stuck.map(function (item) { return self._toCardData(item); }),
        warmingDelta: warmingDelta,
        coolingDelta: coolingDelta,
        stuckDelta: stuckDelta,
        loading: false
      });
    });
  },

  _toCardData: function (item) {
    var c = item.customer;
    var lastVisit = c.last_visit || '';
    var visitCountText = '';
    var growthRate = '';
    var hasGrowth = false;
    var signalText = '';

    if (item.type === 'warming') {
      visitCountText = '最近14天拜访' + item.recentCount + '次';
      if (item.ratio > 1) {
        growthRate = '↑' + Math.round((item.ratio - 1) * 100) + '%';
        hasGrowth = true;
        signalText = '较前期拜访频率提升';
      } else {
        signalText = '拜访频率持续活跃';
      }
    } else if (item.type === 'cooling') {
      visitCountText = '最近14天拜访' + item.recentCount + '次';
      signalText = '已' + item.coldDays + '天未联系';
    } else if (item.type === 'stuck') {
      signalText = '卡在' + c.stage + ' ' + item.overdueDays + '天';
    }

    return {
      id: c.id,
      name: c.name,
      stage: c.stage,
      stageClass: constants.STAGE_CLASS_MAP[c.stage] || 'comm',
      type: item.type,
      visitCountText: visitCountText,
      growthRate: growthRate,
      hasGrowth: hasGrowth,
      signalText: signalText,
      lastVisit: lastVisit,
      lastVisitLabel: this._formatLastVisit(lastVisit),
      lastVisitWay: item.lastVisitWay || ''
    };
  },

  _formatLastVisit: function (dateStr) {
    if (!dateStr) return '暂无拜访';
    var diff = dateUtil.daysBetween(dateUtil.today(), dateStr);
    if (diff === 0) return '今天';
    if (diff === 1) return '昨天';
    if (diff <= 7) return diff + '天前';
    return dateStr.substring(5);
  },

  _computeWeekDelta: function (items, records, today) {
    if (!items || items.length === 0) return '0';
    var thisWeekCount = 0;
    var lastWeekCount = 0;

    items.forEach(function (item) {
      var customerId = item.customer.id;
      var customerRecords = records.filter(function (r) { return r.customer_id === customerId; });
      var thisWeekVisits = 0;
      var lastWeekVisits = 0;

      customerRecords.forEach(function (r) {
        var daysDiff = dateUtil.daysBetween(today, r.visit_date);
        if (daysDiff >= 0 && daysDiff <= 7) {
          thisWeekVisits++;
        } else if (daysDiff > 7 && daysDiff <= 14) {
          lastWeekVisits++;
        }
      });

      if (thisWeekVisits > 0) thisWeekCount++;
      if (lastWeekVisits > 0) lastWeekCount++;
    });

    var delta = thisWeekCount - lastWeekCount;
    return (delta > 0 ? '+' : '') + delta;
  },

  onTabChange: function (e) {
    this.setData({ activeTab: e.currentTarget.dataset.tab });
  },

  onCustomerTap: function (e) {
    var id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/customer-detail/index?id=' + id });
  }
});

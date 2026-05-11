/**
 * referral-network/index.js — 转介绍网络页
 * 展示某客户的上游来源和下游被介绍客户列表
 */

var referralRepo = require('../../utils/repository/referral.repo');
var storage = require('../../utils/storage');
var toast = require('../../utils/toast');

var STAGE_CLASS_MAP = {
  '初步认识': 'meet',
  '需求沟通': 'comm',
  '方案讲解': 'present',
  '待促成':   'closing',
  '已成交':   'deal',
  '已流失':   'lost'
};

/** 金额格式化 */
function fmtPremium(n) {
  if (!n || n === 0) return '—';
  if (n >= 10000) {
    var wan = n / 10000;
    return (wan % 1 === 0 ? wan.toString() : wan.toFixed(1)) + '万元/年';
  }
  return n + '元/年';
}

/** 最近沟通文字 */
function fmtLastVisit(dateStr) {
  if (!dateStr) return '未拜访';
  var today = new Date();
  var visit = new Date(dateStr);
  var diff = Math.floor((today - visit) / 86400000);
  if (diff === 0) return '今天';
  if (diff === 1) return '昨天';
  if (diff <= 7) return diff + '天前';
  if (diff <= 30) return Math.floor(diff / 7) + '周前';
  return Math.floor(diff / 30) + '个月前';
}

Page({
  data: {
    loading: true,
    current: null,
    upstream: null,
    downstream: [],
    stageClassMap: STAGE_CLASS_MAP
  },

  onLoad: function (options) {
    var self = this;
    storage.waitReady().then(function () {
      var customerId = parseInt(options.id);
      self._loadNetwork(customerId);
    });
  },

  onShow: function () {
    var current = this.data.current;
    if (current) this._loadNetwork(current.id);
  },

  _loadNetwork: function (customerId) {
    var network = referralRepo.getNetwork(customerId);
    if (!network.current) {
      toast.fail('客户不存在');
      setTimeout(function () { wx.navigateBack(); }, 1500);
      return;
    }

    var downstream = (network.downstream || []).map(function (c) {
      return Object.assign({}, c, {
        premiumText: fmtPremium(c.total_premium),
        lastVisitText: fmtLastVisit(c.last_visit)
      });
    });

    this.setData({
      loading: false,
      current: network.current,
      upstream: network.upstream,
      downstream: downstream
    });
  },

  /** 点击任意客户卡片跳转详情 */
  onTapCustomer: function (e) {
    var id = parseInt(e.currentTarget.dataset.id);
    wx.navigateTo({ url: '/pages/customer-detail/index?id=' + id });
  }
});

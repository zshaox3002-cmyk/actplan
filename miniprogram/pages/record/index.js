/**
 * record/index.js — 拜访记录列表页
 * 功能：按 visit_date 倒序展示 + FAB 直接新建 + 异议池入口 banner
 * 三态：loading(skeleton) / empty(empty-state) / data(list)
 */

var recordRepo = require('../../utils/repository/record.repo');
var customerRepo = require('../../utils/repository/customer.repo');
var toast = require('../../utils/toast');

Page({
  data: {
    records: [],
    customerMap: {},
    pageState: 'loading'   // 'loading' | 'empty' | 'data' | 'error'
  },

  onLoad: function () {
    this._loadList();
  },

  onShow: function () {
    this._loadList();
  },

  _loadList: function () {
    try {
      var records = recordRepo.list();
      var customerMap = {};

      for (var i = 0; i < records.length; i++) {
        var cid = records[i].customer_id;
        if (!customerMap[cid]) {
          var customer = customerRepo.get(cid);
          customerMap[cid] = customer ? customer.name : '未知客户';
        }
      }

      this.setData({
        records: records,
        customerMap: customerMap,
        pageState: records.length === 0 ? 'empty' : 'data'
      });
    } catch (e) {
      this.setData({ pageState: 'error' });
      toast.fail('加载失败');
    }
  },

  /** 点击记录卡片 */
  onRecordTap: function (e) {
    toast.warn('记录详情待实现');
  },

  /** 跳转异议池 */
  onObjectionTap: function () {
    wx.navigateTo({
      url: '/pages/objection/index'
    });
  },

  /** FAB 直接新建 */
  onFabTap: function () {
    wx.navigateTo({
      url: '/pages/record-new/index?mode=direct'
    });
  },

  /** 空状态操作按钮 */
  onEmptyAction: function () {
    wx.navigateTo({
      url: '/pages/record-new/index?mode=direct'
    });
  }
});

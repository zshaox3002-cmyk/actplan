/**
 * customer/index.js — 客户列表页
 * 功能：搜索 + 筛选 + 卡片列表 + FAB 新建
 * 三态：loading(skeleton) / empty(empty-state) / data(list)
 */

var customerRepo = require('../../utils/repository/customer.repo');
var storage = require('../../utils/storage');
var toast = require('../../utils/toast');

Page({
  data: {
    // 三态
    loading: true,
    pageState: 'loading',   // 'loading' | 'empty' | 'data' | 'error'

    customers: [],
    keyword: '',
    appleRank: '全部',
    stage: '全部'
  },

  onLoad: function () {
    this._safeLoad();
  },

  onShow: function () {
    if (!this.data.loading) {
      this._safeLoad();
    }
  },

  /** 等待 Storage 就绪后再加载 */
  _safeLoad: function () {
    var that = this;
    if (storage.isReady()) {
      that._loadList();
    } else {
      storage.waitReady().then(function () {
        that._loadList();
      });
    }
  },

  /**
   * 加载客户列表
   * @private
   */
  _loadList: function () {
    try {
      var filters = {
        keyword: this.data.keyword,
        appleRank: this.data.appleRank,
        stage: this.data.stage
      };
      var list = customerRepo.list(filters);
      var pageState = list.length === 0 ? (this.data.keyword || this.data.appleRank !== '全部' || this.data.stage !== '全部' ? 'empty' : 'empty') : 'data';

      this.setData({
        customers: list,
        pageState: pageState,
        loading: false
      });
    } catch (e) {
      this.setData({ pageState: 'error', loading: false });
      toast.fail('加载失败');
    }
  },

  /** 搜索输入 */
  onSearchInput: function (e) {
    this.setData({ keyword: e.detail.value });
    this._loadList();
  },

  /** 搜索清除 */
  onSearchClear: function () {
    this.setData({ keyword: '' });
    this._loadList();
  },

  /** 筛选变化 */
  onFilterChange: function (e) {
    var type = e.detail.type;
    var value = e.detail.value;
    var update = {};
    update[type] = value;
    this.setData(update);
    this._loadList();
  },

  /** 点击客户卡片 */
  onCustomerTap: function (e) {
    var id = e.detail.id;
    wx.navigateTo({
      url: '/pages/customer-detail/index?id=' + id + '&mode=edit'
    });
  },

  /** 删除客户 */
  onCustomerDelete: function (e) {
    var id = parseInt(e.detail.id);
    try {
      customerRepo.delete(id);
      toast.success('已删除');
      this._loadList();
    } catch (err) {
      console.error('[Customer] 删除失败:', err.message || err);
      toast.fail('删除失败');
    }
  },

  /** 页面空白区域点击 — 收起所有卡片和下拉 */
  onPageTap: function () {
    // 收起所有左滑卡片
    var cards = this.selectAllComponents('.customer-card-component');
    for (var i = 0; i < cards.length; i++) {
      cards[i].closeSwipe();
    }
  },

  /** FAB 新建客户 */
  onAddCustomer: function () {
    wx.navigateTo({
      url: '/pages/customer-detail/index'
    });
  },

  /** 空状态操作按钮 */
  onEmptyAction: function () {
    wx.navigateTo({
      url: '/pages/customer-detail/index'
    });
  }
});

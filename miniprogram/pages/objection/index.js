/**
 * objection/index.js — 异议池主页
 * 功能：分类筛选 + 排序切换 + 列表展示 + FAB 新建
 * 三态：loading(skeleton) / empty(empty-state) / data(list)
 */

var objectionRepo = require('../../utils/repository/objection.repo');
var toast = require('../../utils/toast');

Page({
  data: {
    // 三态
    pageState: 'loading',   // 'loading' | 'empty' | 'data' | 'error'

    // 列表
    objections: [],

    // 筛选
    currentCategory: '',    // '' = 全部

    // 排序
    sortBy: 'recent',       // 'recent' | 'count'

    // 分类统计
    categoryStats: [],
    objectionTotal: 0
  },

  onShow: function () {
    this._loadList();
  },

  /** 加载异议列表 */
  _loadList: function () {
    try {
      var filters = {
        category: this.data.currentCategory || '全部',
        sortBy: this.data.sortBy === 'recent' ? 'created_at' : 'count'
      };
      var list = objectionRepo.list(filters);

      this.setData({
        objections: list,
        pageState: list.length === 0 ? 'empty' : 'data'
      });

      // 更新分类统计（基于全量数据，不受筛选影响）
      this._computeCategoryStats();
    } catch (e) {
      this.setData({ pageState: 'error' });
      toast.fail('加载失败');
    }
  },

  /** 分类标签点击 */
  onSelectCategory: function (e) {
    var cat = e.currentTarget.dataset.cat;
    this.setData({ currentCategory: cat });
    this._loadList();
  },

  /** 排序切换 */
  onToggleSort: function () {
    var newSortBy = this.data.sortBy === 'recent' ? 'count' : 'recent';
    this.setData({ sortBy: newSortBy });
    this._loadList();
  },

  /** 计算分类统计数据 */
  _computeCategoryStats: function () {
    // 获取全量异议数据用于统计
    var allObjections = objectionRepo.list({ category: '全部', sortBy: 'created_at' });
    var countMap = {};

    for (var i = 0; i < allObjections.length; i++) {
      var cat = allObjections[i].category;
      countMap[cat] = (countMap[cat] || 0) + 1;
    }

    var keys = Object.keys(countMap);
    keys.sort(function (a, b) { return countMap[b] - countMap[a]; });

    var stats = [];
    for (var j = 0; j < keys.length; j++) {
      var key = keys[j];
      stats.push({
        key: key,
        label: key,
        count: countMap[key]
      });
    }

    this.setData({
      categoryStats: stats,
      objectionTotal: allObjections.length
    });
  },

  /** FAB 新建异议 */
  onAddObjection: function () {
    wx.navigateTo({
      url: '/pages/objection-new/index'
    });
  },

  /** 空状态操作按钮 */
  onEmptyAction: function () {
    wx.navigateTo({
      url: '/pages/objection-new/index'
    });
  },

  /** 异议卡片左滑删除 */
  onObjectionDelete: function (e) {
    var id = e.detail.id;
    if (!id) return;

    try {
      objectionRepo.remove(id);
      toast.success('已删除');
      // 刷新列表
      this._loadList();
    } catch (err) {
      toast.fail('删除失败：' + err.message);
    }
  }
});

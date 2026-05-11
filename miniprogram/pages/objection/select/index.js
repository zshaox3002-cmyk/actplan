/**
 * objection/select/index.js — 异议选择页
 * 从拜访记录录入页跳入，用于勾选已有异议或新建新异议
 * 通过 EventChannel 将选中结果回传给 opener
 */

var objectionRepo = require('../../../utils/repository/objection.repo');

/** 分类列表（与 PRESET_OBJECTIONS 的 category 字段一致） */
var CATEGORIES = ['价格', '时机', '必要性', '产品对比', '信任'];

/** 分类 → 标签样式映射 */
var TAG_CLS = {
  '价格': 'tag-red',
  '时机': 'tag-blue',
  '必要性': 'tag-yellow',
  '产品对比': 'tag-purple',
  '信任': 'tag-green',
  '其他': 'tag-gray'
};

Page({
  data: {
    allObjections: [],
    filteredList: [],
    selectedIds: [],
    currentCat: 'all',
    keyword: '',
    categories: CATEGORIES,
    isSaving: false
  },

  // 页面实例属性（不经过 setData，不受序列化影响）
  _channel: null,
  _justCreatedIds: null,

  onLoad: function (options) {
    // 初始化实例属性
    this._channel = this.getOpenerEventChannel && this.getOpenerEventChannel();
    this._justCreatedIds = [];

    // 接收已选 ids（编辑场景，从 URL 参数传入）
    var selected = [];
    if (options.selected) {
      try { selected = JSON.parse(decodeURIComponent(options.selected)); } catch (e) {}
    }

    // 加载全部异议（预置 + 用户自建）
    var all = [];
    try {
      all = (objectionRepo.list() || []).map(function (o) {
        return Object.assign({}, o, {
          tagCls: TAG_CLS[o.category] || 'tag-gray',
          title: o.title || o.content || ''
        });
      });
    } catch (e) {
      console.warn('[ObjectionSelect] 加载失败:', e);
    }

    this.setData({ allObjections: all, filteredList: [], selectedIds: selected });

    // 首次筛选（计算 isSelected）
    this._filter();
  },

  onSearch: function (e) {
    this.setData({ keyword: e.detail.value });
    this._filter();
  },

  onSelectCat: function (e) {
    this.setData({ currentCat: e.currentTarget.dataset.cat });
    this._filter();
  },

  /** 筛选：分类 + 关键词 + 计算 isSelected */
  _filter: function () {
    var d = this.data;
    var list = d.allObjections;
    var selectedIds = d.selectedIds;

    if (d.currentCat !== 'all') {
      list = list.filter(function (o) { return o.category === d.currentCat; });
    }
    if (d.keyword) {
      var kw = d.keyword.toLowerCase();
      list = list.filter(function (o) {
        var title = (o.title || '').toLowerCase();
        var content = (o.content || '').toLowerCase();
        return title.indexOf(kw) >= 0 || content.indexOf(kw) >= 0;
      });
    }

    // 为每项计算 isSelected 布尔字段，替代 WXML 中的 indexOf 表达式
    list = list.map(function (o) {
      var isSelected = selectedIds.indexOf(o.id) >= 0;
      return Object.assign({}, o, { isSelected: isSelected });
    });

    this.setData({ filteredList: list });
  },

  onToggleSelect: function (e) {
    var id = e.currentTarget.dataset.id;
    // WeChat dataset 将所有值转为字符串，需要还原数字类型以匹配 filteredList 中的 item.id
    if (/^\d+$/.test(id)) {
      id = parseInt(id, 10);
    }
    var ids = this.data.selectedIds.slice();
    var idx = ids.indexOf(id);
    if (idx >= 0) {
      ids.splice(idx, 1);
    } else {
      ids.push(id);
    }
    this.setData({ selectedIds: ids });
    this._filter(); // 重新计算 isSelected
  },

  /** 跳转新建异议 */
  onAddNew: function () {
    var that = this;
    wx.navigateTo({
      url: '/pages/objection-new/index?from=select',
      events: {
        onObjectionCreated: function (obj) {
          // 新建完成后自动追加并选中
          console.warn('[ObjectionSelect] onObjectionCreated: id=' + obj.id + ' type=' + typeof obj.id);

          var all = that.data.allObjections.slice();
          var newObj = Object.assign({}, obj, {
            tagCls: TAG_CLS[obj.category] || 'tag-gray',
            title: obj.content || ''
          });
          all.push(newObj);

          var newIds = that.data.selectedIds.slice();
          newIds.push(obj.id);

          // 用实例属性记录"本次新建"的 ID（不走 setData，不受序列化影响）
          if (obj.id != null) { that._justCreatedIds.push(obj.id); }
          console.warn('[ObjectionSelect] _justCreatedIds after push:', JSON.stringify(that._justCreatedIds));

          that.setData({
            allObjections: all,
            selectedIds: newIds
          });
          that._filter(); // 重新筛选
        }
      }
    });
  },

  /** 确认回传 */
  onConfirm: function () {
    if (this.data.isSaving) return;
    if (this.data.selectedIds.length === 0) return;

    this.setData({ isSaving: true });
    try {
      var selected = this.data.allObjections.filter(function (o) {
        return this.data.selectedIds.indexOf(o.id) >= 0;
      }.bind(this));

      // 诊断日志
      console.warn('[ObjectionSelect] onConfirm: selectedIds=' + JSON.stringify(this.data.selectedIds));
      console.warn('[ObjectionSelect] onConfirm: _justCreatedIds=' + JSON.stringify(this._justCreatedIds));
      console.warn('[ObjectionSelect] onConfirm: selected items id list=' + JSON.stringify(selected.map(function(o) { return o.id; })));

      // 回传：把 justCreatedIds 作为独立字段传出去（不依赖对象属性）
      // 注意：计数修改统一在 record-new onSave 中处理，选择确认不修改任何数据
      if (this._channel && this._channel.emit) {
        this._channel.emit('onSelected', {
          items: selected,
          justCreatedIds: this._justCreatedIds.slice()
        });
      }
    } finally {
      this.setData({ isSaving: false });
    }

    wx.navigateBack();
  }
});

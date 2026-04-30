/**
 * objection-detail/index.js — 异议详情页
 * 显示：分类徽章、出现次数、创建时间、异议内容原文、应对话术、追加历史
 */

var objectionRepo = require('../../utils/repository/objection.repo');
var customerRepo = require('../../utils/repository/customer.repo');
var toast = require('../../utils/toast');

/**
 * 中文分类 → 英文 CSS 类名映射
 */
var CATEGORY_CLASS_MAP = {
  '价格': 'price',
  '必要性': 'necessity',
  '时机': 'timing',
  '产品对比': 'compare',
  '信任': 'trust',
  '其他': 'other'
};

Page({
  data: {
    id: null,
    objection: null,
    notes: [],
    customerMap: {},
    categoryClass: 'other',
    resolutionRate: null,   // null = 样本不足，0-100 = 百分比
    resolutionTotal: 0,
    resolutionResolved: 0
  },

  onLoad: function (options) {
    // 预置异议 id 为字符串（如 'preset_price_01'），自建为数字，均不能 parseInt
    var id = options.id || null;
    if (!id) {
      toast.fail('参数错误');
      return;
    }

    // 如果是纯数字字符串，转为数字类型以兼容自建异议
    if (/^\d+$/.test(id)) {
      id = parseInt(id, 10);
    }

    this.setData({ id: id });
    this._loadDetail(id);
  },

  onShow: function () {
    if (this.data.id) {
      this._loadDetail(this.data.id);
    }
  },

  /** 加载详情 */
  _loadDetail: function (id) {
    var objection = objectionRepo.get(id);
    if (!objection) {
      toast.fail('异议不存在');
      return;
    }

    // 获取追加备注
    var notes = objectionRepo.listNotes(id);

    // 构建客户名映射
    var customerMap = {};
    // 原始客户
    if (objection.customer_id) {
      var c = customerRepo.get(objection.customer_id);
      if (c) customerMap[objection.customer_id] = c.name;
    }
    // 备注关联客户
    for (var i = 0; i < notes.length; i++) {
      var cid = notes[i].customer_id;
      if (cid && !customerMap[cid]) {
        var cc = customerRepo.get(cid);
        if (cc) customerMap[cid] = cc.name;
      }
    }

    var rr = objectionRepo.getResolutionRate(id);

    this.setData({
      objection: objection,
      notes: notes,
      customerMap: customerMap,
      categoryClass: CATEGORY_CLASS_MAP[objection.category] || 'other',
      resolutionRate: rr.rate,
      resolutionTotal: rr.total,
      resolutionResolved: rr.resolved
    });
  }
});

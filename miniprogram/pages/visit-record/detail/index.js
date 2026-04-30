/**
 * visit-record/detail — 拜访记录详情页
 * 展示：客户信息条 + 本次拜访 + 跟进进展 + 异议记录
 */

var recordRepo = require('../../../utils/repository/record.repo');
var customerRepo = require('../../../utils/repository/customer.repo');
var planRepo = require('../../../utils/repository/plan.repo');
var objectionRepo = require('../../../utils/repository/objection.repo');

// 跟进阶段徽章样式映射
var STAGE_CLS = {
  '初步认识': 'stage-gray',
  '需求沟通': 'stage-blue',
  '方案讲解': 'stage-purple',
  '待促成':   'stage-orange',
  '已成交':   'stage-green',
  '已流失':   'stage-red'
};

// 异议分类徽章颜色
var OBJ_TAG_CLS = {
  '价格': 'tag-red',
  '时机': 'tag-blue',
  '必要性': 'tag-yellow',
  '产品对比': 'tag-purple',
  '信任': 'tag-green'
};

Page({
  data: {
    record: {},
    customer: {},
    relatedPlan: null,
    objections: [],
    stageCls: '',
    formattedTime: ''
  },

  onLoad: function (options) {
    if (!options || !options.id) {
      wx.navigateBack();
      return;
    }

    var id = parseInt(options.id);
    var record = recordRepo.get(id);
    if (!record) {
      wx.showToast({ title: '记录不存在', icon: 'none' });
      wx.navigateBack();
      return;
    }

    var customer = record.customer_id ? customerRepo.get(record.customer_id) : {};
    // 记录的 stage 优先，fallback 到客户当前阶段
    var displayStage = record.stage || (customer && customer.stage) || '需求沟通';
    var stageCls = STAGE_CLS[displayStage] || 'stage-blue';

    // 查找下次跟进日期对应的自动创建计划
    var relatedPlan = null;
    if (record.next_follow_date) {
      var dayPlans = planRepo.list(record.next_follow_date);
      for (var i = 0; i < dayPlans.length; i++) {
        if (dayPlans[i].customer_id === record.customer_id) {
          relatedPlan = dayPlans[i];
          break;
        }
      }
    }

    // 查找本次拜访关联的异议（按 record.objection_ids 精确匹配）
    var objections = [];
    var ids = record.objection_ids || [];
    if (ids.length > 0) {
      for (var j = 0; j < ids.length; j++) {
        var obj = objectionRepo.get(ids[j]);
        if (obj) {
          objections.push({
            id: obj.id,
            content: obj.content,
            category: obj.category,
            tagCls: OBJ_TAG_CLS[obj.category] || 'tag-gray'
          });
        }
      }
    }

    // 旧数据兼容：若无 objection_ids 但 has_objection=1，fallback 按 customer_id 取自建异议
    if (objections.length === 0 && record.has_objection && record.customer_id) {
      var allObjections = objectionRepo.list({ category: '全部', sortBy: 'created_at' });
      var targetCustomerId = Number(record.customer_id);
      for (var k = 0; k < allObjections.length; k++) {
        var o = allObjections[k];
        if (o.isPreset) continue;
        var oCid = o.customer_id != null ? Number(o.customer_id) : null;
        if (oCid === targetCustomerId) {
          objections.push({
            id: o.id,
            content: o.content,
            category: o.category,
            tagCls: OBJ_TAG_CLS[o.category] || 'tag-gray'
          });
        }
      }
    }

    // 将异议嵌入 record 对象
    record.objections = objections;

    // 兜底：如果记录没有 stage，从客户阶段回填（兼容旧数据）
    if (!record.stage) {
      record.stage = displayStage;
    }

    // 格式化创建时间
    var formattedTime = '';
    if (record.created_at) {
      var d = new Date(record.created_at);
      if (!isNaN(d.getTime())) {
        var mm = d.getMonth() + 1;
        var dd = d.getDate();
        var hh = d.getHours();
        var mi = d.getMinutes();
        formattedTime = d.getFullYear() + '-' +
          (mm < 10 ? '0' + mm : mm) + '-' +
          (dd < 10 ? '0' + dd : dd) + ' ' +
          (hh < 10 ? '0' + hh : hh) + ':' +
          (mi < 10 ? '0' + mi : mi);
      } else {
        formattedTime = record.created_at;
      }
    }

    this.setData({
      record: record,
      customer: customer || {},
      relatedPlan: relatedPlan,
      objections: objections,
      hasObjections: objections.length > 0,
      stageCls: stageCls,
      formattedTime: formattedTime
    });
  },

  /** 查看客户详情 */
  onViewCustomer: function () {
    var record = this.data.record;
    if (record.customer_id) {
      wx.navigateTo({ url: '/pages/customer-detail/index?id=' + record.customer_id });
    }
  },

  /** 查看关联计划 */
  onViewPlan: function () {
    var plan = this.data.relatedPlan;
    if (plan) {
      wx.navigateTo({ url: '/pages/customer-detail/index?id=' + plan.customer_id });
    }
  },

  /** 查看异议详情 */
  onViewObjection: function (e) {
    var id = e.currentTarget.dataset.id;
    if (id) {
      wx.navigateTo({ url: '/pages/objection-detail/index?id=' + id });
    }
  }
});

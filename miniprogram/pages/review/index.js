/**
 * review/index.js — 复盘页
 * 周期性回顾：活动摘要、方式对比、阶段流转、异议回顾、文字洞察
 */

var storage = require('../../utils/storage');
var reviewStats = require('../../utils/review-stats');
var insight = require('../../utils/insight');

Page({
  data: {
    period: 'thisWeek',
    periodLabel: '本周',
    insightText: '',
    metricCards: [],
    methodList: [],
    flowList: [],
    objectionSummary: null,
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

  /**
   * 切换周期
   */
  onPeriodChange: function (e) {
    var period = e.currentTarget.dataset.period;
    var labels = { thisWeek: '本周', lastWeek: '上周', thisMonth: '本月' };
    this.setData({ period: period, periodLabel: labels[period] });
    this._loadData();
  },

  onToggleCatExpand: function (e) {
    var idx = parseInt(e.currentTarget.dataset.idx);
    var cats = this.data.objectionSummary.categories.slice();
    var cat = Object.assign({}, cats[idx]);
    cat.expanded = !cat.expanded;
    cat.visibleItems = cat.expanded ? cat.items : cat.items.slice(0, 3);
    cats[idx] = cat;
    this.setData({ 'objectionSummary.categories': cats });
  },

  /**
   * 加载复盘数据
   */
  _loadData: function () {
    var self = this;
    storage.waitReady().then(function () {
      var snapshot = self._getSnapshot();
      var period = self.data.period;

      var ranges = reviewStats.getRanges(period);
      var metricsResult = reviewStats.getReviewMetrics(snapshot, ranges);
      var methodList = reviewStats.getMethodComparison(snapshot, ranges);
      var flowList = reviewStats.getStageFlow(snapshot, ranges);
      var objectionSummary = reviewStats.getObjectionSummary(snapshot, ranges);
      // 默认折叠，每个分类只展示前 3 条
      if (objectionSummary && objectionSummary.categories) {
        objectionSummary.categories = objectionSummary.categories.map(function (cat) {
          return Object.assign({}, cat, {
            expanded: false,
            visibleItems: cat.items.slice(0, 3),
            hasMore: cat.items.length > 3
          });
        });
      }

      var current = metricsResult.current;
      var previous = metricsResult.previous;

      var metricCards = self._buildMetricCards(current, previous);
      var insightText = insight.generateInsight(current, previous, methodList);

      self.setData({
        metricCards: metricCards,
        methodList: methodList,
        flowList: flowList,
        objectionSummary: objectionSummary,
        insightText: insightText,
        loading: false
      });
    });
  },

  /**
   * 预计算指标卡片数据，避免 WXML 中的嵌套三元表达式
   */
  _buildMetricCards: function (current, previous) {
    function card(label, cur, prev) {
      var d = cur - prev;
      return {
        label: label,
        value: cur,
        arrow: d > 0 ? '↑' : d < 0 ? '↓' : '→',
        absDelta: Math.abs(d),
        cls: d > 0 ? 'delta-up' : d < 0 ? 'delta-down' : ''
      };
    }
    return [
      card('拜访', current.visitCount, previous.visitCount),
      card('新客', current.newCustomers, previous.newCustomers),
      card('预约', current.appointmentCount, previous.appointmentCount),
      card('推进', current.stageAdvances, previous.stageAdvances),
      card('成交单量', current.dealPolicyCount, previous.dealPolicyCount)
    ];
  },

  /**
   * 一次性加载所有需要的表
   */
  _getSnapshot: function () {
    return {
      customer: storage.getTable('customer'),
      visit_record: storage.getTable('visit_record'),
      plan: storage.getTable('plan'),
      policy: storage.getTable('policy'),
      objection: storage.getTable('objection'),
      objection_note: storage.getTable('objection_note'),
      operation_log: storage.getTable('operation_log')
    };
  }
});

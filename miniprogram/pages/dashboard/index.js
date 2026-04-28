/**
 * dashboard/index.js — 数据概览页
 *
 * 布局：
 * - 顶部 周期选择栏（本周/本月/季度/年度 下拉切换）
 * - 2×2 指标卡：客户总量 / 本期新增 / 本期拜访 / 本期预约
 * - 苹果分布饼图
 * - 异议分布柱状图
 */

var stats = require('../../utils/stats');
var dateUtil = require('../../utils/date');
var storage = require('../../utils/storage');
var toast = require('../../utils/toast');

/** 周期配置 */
var PERIOD_CONFIG = {
  week:    { label: '本周数据', rangeFn: dateUtil.getWeekRange },
  month:   { label: '本月数据', rangeFn: dateUtil.getMonthRange },
  quarter: { label: '季度数据', rangeFn: dateUtil.getQuarterRange },
  year:    { label: '年度数据', rangeFn: dateUtil.getYearRange }
};

Page({
  data: {
    // 周期选择
    currentPeriod: 'week',
    periodLabel: '本周数据',
    periodRange: '',
    showPeriodDropdown: false,

    // 指标
    metrics: {
      totalCustomers: 0,
      newCustomers: 0,
      visitCount: 0,
      appointmentCount: 0
    },

    // 苹果分布
    appleData: [],

    // 异议分布
    objectionData: [],

    // 空态
    isEmpty: false

    /* DISABLED: import-export - 暂时禁用，保留备用
    ,
    // 数据操作面板
    showDataPanel: false
    */
  },

  onLoad: function () {
    this._updatePeriodDisplay();
    this._safeRefresh(this.data.currentPeriod);
  },

  onShow: function () {
    this._updatePeriodDisplay();
    this._safeRefresh(this.data.currentPeriod);
  },

  /** 等待 Storage 就绪后再刷新，防止竞态 */
  _safeRefresh: function (period) {
    var that = this;
    var p = period || this.data.currentPeriod;
    if (storage.isReady()) {
      that._refresh(p);
    } else {
      storage.waitReady().then(function () {
        that._refresh(p);
      });
    }
  },

  /** 根据当前周期更新显示文案和日期范围 */
  _updatePeriodDisplay: function () {
    var period = this.data.currentPeriod;
    var config = PERIOD_CONFIG[period];
    var range = config.rangeFn();

    var startParts = range[0].split('-');
    var endParts = range[1].split('-');
    var periodRange = (parseInt(startParts[1])) + '.' + (parseInt(startParts[2])) +
      ' - ' + (parseInt(endParts[1])) + '.' + (parseInt(endParts[2]));

    // 年度显示年份
    if (period === 'year') {
      periodRange = startParts[0] + '年';
    }

    this.setData({
      periodLabel: config.label,
      periodRange: periodRange
    });
  },

  /** 刷新所有数据 */
  _refresh: function (period) {
    try {
      var snapshot = stats.getStatsSnapshot();
      var activePeriod = period || this.data.currentPeriod;
      // 指标（按周期过滤）
      var metrics = stats.getDashboardMetrics(snapshot, activePeriod);

      // 苹果分布
      var appleData = stats.getAppleDistribution(snapshot);
      var appleColorMap = {
        '红苹果': '#E74C3C',
        '青苹果': '#27AE60',
        '烂苹果': '#6B7280',
        '待定': '#F39C12'
      };
      for (var i = 0; i < appleData.length; i++) {
        appleData[i].color = appleColorMap[appleData[i].name] || '#9CA3AF';
      }

      // 异议分布
      var objectionData = stats.getObjectionDistribution(snapshot);

      this.setData({
        metrics: metrics,
        appleData: appleData,
        objectionData: objectionData,
        isEmpty: metrics.totalCustomers === 0
      });
    } catch (e) {
      toast.fail('数据加载失败');
      console.error('[Dashboard] _refresh error:', e);
    }
  },

  /** 空态引导：添加客户 */
  onGoAddCustomer: function () {
    wx.switchTab({ url: '/pages/customer/index' });
  },

  /** 空态引导：创建拜访计划 */
  onGoAddPlan: function () {
    wx.switchTab({ url: '/pages/plan/index' });
  },

  /** 打开周期下拉 */
  onPeriodTap: function () {
    this.setData({ showPeriodDropdown: !this.data.showPeriodDropdown });
  },

  /** 选择周期 */
  onPeriodSelect: function (e) {
    var period = e.currentTarget.dataset.period;
    if (period === this.data.currentPeriod) {
      this.setData({ showPeriodDropdown: false });
      return;
    }
    this.setData({
      currentPeriod: period,
      showPeriodDropdown: false
    });
    this._updatePeriodDisplay();
    this._refresh(period);
  },

  /** 点击遮罩关闭下拉 */
  onDropdownMaskTap: function () {
    this.setData({ showPeriodDropdown: false });
  }

  /* DISABLED: import-export - 暂时禁用，保留备用

  ,

  onDataMenuTap: function () {
    this.setData({ showDataPanel: true });
  },

  onClosePanel: function () {
    this.setData({ showDataPanel: false });
  },

  onExportData: function () {
    try {
      var dump = {
        customer: storage.getTable('customer'),
        plan: storage.getTable('plan'),
        visit_record: storage.getTable('visit_record'),
        objection: storage.getTable('objection'),
        objection_note: storage.getTable('objection_note'),
        operation_log: storage.getTable('operation_log'),
        exported_at: new Date().toISOString()
      };

      var jsonStr = JSON.stringify(dump);

      wx.setClipboardData({
        data: jsonStr,
        success: function () {
          toast.success('数据已复制到剪贴板');
        },
        fail: function () {
          toast.fail('复制失败，数据量可能过大');
        }
      });

      this.setData({ showDataPanel: false });
    } catch (e) {
      toast.fail('导出失败：' + e.message);
    }
  },

  onImportData: function () {
    var that = this;
    this.setData({ showDataPanel: false });

    wx.showModal({
      title: '导入数据',
      content: '请先复制导出的 JSON 数据到剪贴板，点击确定将从剪贴板读取并覆盖当前所有数据。此操作不可逆！',
      confirmText: '确定导入',
      confirmColor: '#E74C3C',
      success: function (res) {
        if (res.confirm) {
          that._doImport();
        }
      }
    });
  },

  _doImport: function () {
    var that = this;
    wx.getClipboardData({
      success: function (res) {
        try {
          var data = JSON.parse(res.data);

          if (!data || typeof data !== 'object') {
            toast.fail('数据格式不正确');
            return;
          }

          var tables = ['customer', 'plan', 'visit_record', 'objection', 'objection_note', 'operation_log'];
          for (var i = 0; i < tables.length; i++) {
            var t = tables[i];
            if (data[t] && Array.isArray(data[t])) {
              storage.setTable(t, data[t]);
            }
          }

          toast.success('导入成功');
          that._refresh();
        } catch (e) {
          toast.fail('数据解析失败，请确认复制的是正确的导出数据');
        }
      },
      fail: function () {
        toast.fail('读取剪贴板失败');
      }
    });
  },

  onPreventBubble: function () {}
  */
});

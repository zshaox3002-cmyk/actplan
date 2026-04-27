/**
 * dashboard/index.js — 数据概览页
 *
 * 布局：
 * - 顶部 周标识栏（本周数据 + 日期范围）
 * - 2×2 指标卡：客户总量 / 本期新增 / 本期拜访 / 本期预约
 * - 苹果分布饼图
 * - 异议分布柱状图
 */

var stats = require('../../utils/stats');
var storage = require('../../utils/storage');
var toast = require('../../utils/toast');

Page({
  data: {
    // 周标识
    weekRange: '',
    weekNo: 0,

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
    this.computeWeekInfo();
    this._safeRefresh();
  },

  onShow: function () {
    this.computeWeekInfo();
    this._safeRefresh();
  },

  /** 等待 Storage 就绪后再刷新，防止竞态 */
  _safeRefresh: function () {
    var that = this;
    if (storage.isReady()) {
      that._refresh();
    } else {
      storage.waitReady().then(function () {
        that._refresh();
      });
    }
  },

  /** 计算当前周信息 */
  computeWeekInfo: function () {
    var now = new Date();
    var day = now.getDay() || 7; // 周一为 1，周日为 7
    var monday = new Date(now);
    monday.setDate(now.getDate() - day + 1);
    var sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    var fmtMonth = monday.getMonth() + 1;
    var fmtDay1 = monday.getDate() < 10 ? '0' + monday.getDate() : '' + monday.getDate();
    var fmtDay2 = sunday.getDate() < 10 ? '0' + sunday.getDate() : '' + sunday.getDate();

    var weekRange = fmtMonth + '.' + fmtDay1 + ' - ' + (sunday.getMonth() + 1) + '.' + fmtDay2;

    // 计算第几周（ISO 8601 近似）
    var startOfYear = new Date(now.getFullYear(), 0, 1);
    var dayOfYear = Math.floor((now - startOfYear) / 86400000) + 1;
    var weekNo = Math.ceil((dayOfYear + startOfYear.getDay()) / 7);

    this.setData({
      weekRange: weekRange,
      weekNo: weekNo
    });
  },

  /** 刷新所有数据 */
  _refresh: function () {
    try {
      var snapshot = stats.getStatsSnapshot();

      // 指标（仅本周）
      var metrics = stats.getDashboardMetrics(snapshot);

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

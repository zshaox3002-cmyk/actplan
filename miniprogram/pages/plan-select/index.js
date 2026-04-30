/**
 * plan-select/index.js — 添加拜访计划：客户选择页
 * 功能：展示可选择的客户列表（排除本周已有计划的客户），选择后添加计划
 * URL 参数：date — 计划日期 'YYYY-MM-DD'
 */

var customerRepo = require('../../utils/repository/customer.repo');
var planRepo = require('../../utils/repository/plan.repo');
var constants = require('../../utils/constants');
var toast = require('../../utils/toast');
var dateUtil = require('../../utils/date');

Page({
  data: {
    planDate: '',
    customers: [],
    keyword: '',
    visitWayOptions: [],
    selectedCustomerId: null,
    selectedCustomerName: '',
    selectedVisitWay: '面对面',
    planTime: '',
    showConfirm: false,
    isEditMode: false,
    editPlanId: null,
    isCustomerPrefilled: false
  },

  onLoad: function (options) {
    if (options.planId) {
      var plan = planRepo.get(parseInt(options.planId));
      var customer = customerRepo.get(plan.customer_id);
      this.setData({
        planDate: plan.plan_date,
        selectedCustomerId: plan.customer_id,
        selectedCustomerName: customer ? customer.name : '(未知客户)',
        selectedVisitWay: plan.visit_way,
        planTime: plan.plan_time || '',
        showConfirm: true,
        isEditMode: true,
        editPlanId: plan.id,
        visitWayOptions: constants.VISIT_WAY_OPTIONS
      });
      return;
    }
    var date = options.date || dateUtil.today();
    this.setData({
      planDate: date,
      visitWayOptions: constants.VISIT_WAY_OPTIONS
    });

    if (options.customer_id) {
      this.setData({
        selectedCustomerId: parseInt(options.customer_id),
        selectedCustomerName: decodeURIComponent(options.customer_name || ''),
        showConfirm: true,
        isCustomerPrefilled: true
      });
    } else {
      this._loadCustomers();
    }
  },

  /**
   * 加载客户列表
   * 排除本周已有计划的客户（但仍可手动添加，弹窗提示）
   */
  _loadCustomers: function () {
    var allCustomers = customerRepo.list({ keyword: this.data.keyword });
    var weekCustomerIds = planRepo.listCustomerIdsInWeek(this.data.planDate);

    var customers = allCustomers.map(function (c) {
      return Object.assign({}, c, {
        hasPlanThisWeek: weekCustomerIds.indexOf(c.id) >= 0
      });
    });

    // 本周无计划的排前面
    customers.sort(function (a, b) {
      if (a.hasPlanThisWeek !== b.hasPlanThisWeek) {
        return a.hasPlanThisWeek ? 1 : -1;
      }
      return 0;
    });

    this.setData({ customers: customers });
  },

  /** 搜索输入 */
  onSearchInput: function (e) {
    this.setData({ keyword: e.detail.value });
    this._loadCustomers();
  },

  /** 选择客户（customer-card 组件 tap 事件） */
  onCustomerTap: function (e) {
    var id = e.detail.id;
    // 从列表中查找对应客户信息
    var found = null;
    for (var i = 0; i < this.data.customers.length; i++) {
      if (this.data.customers[i].id === id) {
        found = this.data.customers[i];
        break;
      }
    }
    if (!found) return;
    var name = found.name;
    var hasPlan = found.hasPlanThisWeek;

    if (hasPlan) {
      // 本周已有该客户的计划，弹窗提示但仍可添加
      var that = this;
      wx.showModal({
        title: '提示',
        content: '该客户本周已有拜访计划，是否继续添加？',
        confirmText: '继续添加',
        confirmColor: '#0EA5A4',
        success: function (res) {
          if (res.confirm) {
            that.setData({
              selectedCustomerId: id,
              selectedCustomerName: name,
              showConfirm: true
            });
          }
        }
      });
    } else {
      this.setData({
        selectedCustomerId: id,
        selectedCustomerName: name,
        showConfirm: true
      });
    }
  },

  /** 选择拜访方式 */
  onVisitWayChange: function (e) {
    this.setData({
      selectedVisitWay: this.data.visitWayOptions[e.detail.value]
    });
  },

  /** 时间 picker 变化 */
  onPlanTimeChange: function (e) {
    this.setData({ planTime: e.detail.value });
  },

  /** 清除已选时间 */
  onClearPlanTime: function () {
    this.setData({ planTime: '' });
  },

  /** 日期 picker 变化 */
  onPlanDateChange: function (e) {
    this.setData({ planDate: e.detail.value });
  },

  /** 确认添加计划 */
  onConfirmAdd: function () {
    if (!this.data.selectedCustomerId) {
      toast.fail('请选择客户');
      return;
    }
    if (!this.data.planTime) {
      toast.fail('请选择计划时间');
      return;
    }

    if (this.data.isEditMode) {
      planRepo.update(this.data.editPlanId, {
        plan_time: this.data.planTime,
        visit_way: this.data.selectedVisitWay
      });
      toast.success('修改成功');
    } else {
      var result = planRepo.create({
        customer_id: this.data.selectedCustomerId,
        plan_date: this.data.planDate,
        plan_time: this.data.planTime,
        visit_way: this.data.selectedVisitWay
      });

      if (result.conflict) {
        toast.fail('该客户当日已有计划');
      } else {
        toast.success('添加成功');
      }
    }

    // 延迟返回，让 Toast 显示完
    setTimeout(function () {
      wx.navigateBack();
    }, 800);
  },

  /** 取消选择 */
  onCancelSelect: function () {
    if (this.data.isEditMode || this.data.isCustomerPrefilled) {
      wx.navigateBack();
      return;
    }
    this.setData({
      selectedCustomerId: null,
      selectedCustomerName: '',
      planTime: '',
      showConfirm: false
    });
  }
});

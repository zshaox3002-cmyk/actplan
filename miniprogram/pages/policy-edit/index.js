/**
 * policy-edit/index.js — 保单录入/编辑页（v1.1 新增）
 * 新建模式：source='external'，录入他渠道保单
 * 编辑模式：self 保单所有字段只读（不可修改）；external 保单可编辑核心字段
 */

var policyRepo = require('../../utils/repository/policy.repo');
var customerRepo = require('../../utils/repository/customer.repo');
var logRepo = require('../../utils/repository/log.repo');
var storage = require('../../utils/storage');
var toast = require('../../utils/toast');

var PRODUCT_TYPE_OPTIONS = ['重疾', '医疗', '教育金', '养老', '意外', '寿险'];

Page({
  data: {
    isEdit: false,
    policyId: null,
    customerId: null,
    customerName: '',
    isSelf: false,   // source='self' 时核心字段置灰

    productType: '',
    productName: '',
    premium: '',

    productTypeOptions: PRODUCT_TYPE_OPTIONS,
    productTypeIndex: 0
  },

  onLoad: function (options) {
    var customerId = options.customer_id ? parseInt(options.customer_id) : null;
    var policyId = options.policy_id ? parseInt(options.policy_id) : null;

    if (policyId) {
      // 编辑模式
      var all = policyRepo.list(customerId);
      var policy = null;
      for (var i = 0; i < all.length; i++) {
        if (all[i].id === policyId) { policy = all[i]; break; }
      }
      if (policy) {
        var typeIdx = PRODUCT_TYPE_OPTIONS.indexOf(policy.product_type);
        this.setData({
          isEdit: true,
          policyId: policyId,
          customerId: customerId,
          isSelf: policy.source === 'self',
          productType: policy.product_type,
          productTypeIndex: typeIdx >= 0 ? typeIdx : 0,
          productName: policy.product_name || '',
          premium: policy.premium ? String(policy.premium) : ''
        });
        wx.setNavigationBarTitle({ title: '编辑保单' });
      }
    } else {
      // 新建模式
      var customer = customerRepo.get(customerId);
      this.setData({
        customerId: customerId,
        customerName: customer ? customer.name : '',
        productType: PRODUCT_TYPE_OPTIONS[0],
        productTypeIndex: 0
      });
      wx.setNavigationBarTitle({ title: '添加保单' });
    }
  },

  onProductTypeChange: function (e) {
    var idx = parseInt(e.detail.value);
    this.setData({ productType: PRODUCT_TYPE_OPTIONS[idx], productTypeIndex: idx });
  },

  onProductNameInput: function (e) {
    this.setData({ productName: e.detail.value });
  },

  onPremiumInput: function (e) {
    this.setData({ premium: e.detail.value });
  },

  onExpireDateChange: function (e) {
    this.setData({ expireDate: e.detail.value });
  },

  onClearExpireDate: function () {
    this.setData({ expireDate: '' });
  },

  onSave: function () {
    var d = this.data;

    if (!d.productType) {
      wx.showToast({ title: '请选择险种', icon: 'none' });
      return;
    }
    if (!d.isSelf) {
      if (!d.premium || isNaN(parseFloat(d.premium))) {
        wx.showToast({ title: '请填写保费金额', icon: 'none' });
        return;
      }
    }

    try {
      if (d.isEdit) {
        if (d.isSelf) return; // self 保单全只读
        var fields = {
          product_name: d.productName,
          product_type: d.productType,
          premium: parseFloat(d.premium)
        };
        policyRepo.update(d.policyId, fields);

        // 险种变更时更新 coverage_status
        var statusUpdate = {};
        statusUpdate[d.productType] = 'configured';
        customerRepo.update(d.customerId, { coverage_status: statusUpdate, _forceStatus: true });
      } else {
        // 新建 external 保单
        var newPolicy = policyRepo.create({
          customer_id: d.customerId,
          product_type: d.productType,
          product_name: d.productName,
          premium: parseFloat(d.premium),
          effective_date: null,
          expire_date: null,
          source: 'external',
          visit_record_id: null
        });

        // 更新 coverage_status
        var statusUpdate2 = {};
        statusUpdate2[d.productType] = 'configured';
        customerRepo.update(d.customerId, { coverage_status: statusUpdate2, _forceStatus: true });

        // 写入操作日志
        logRepo.add({
          customer_id: d.customerId,
          field: 'policy',
          old_value: '',
          new_value: d.productType + ' external_added'
        });
      }

      toast.success('已保存');
      setTimeout(function () { wx.navigateBack(); }, 600);
    } catch (e) {
      toast.fail(e.message || '保存失败');
    }
  }
});

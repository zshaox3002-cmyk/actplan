/**
 * policy-edit/index.js — 保单录入/编辑页（v1.3 双轴时间模型）
 */

var policyRepo = require('../../utils/repository/policy.repo');
var customerRepo = require('../../utils/repository/customer.repo');
var logRepo = require('../../utils/repository/log.repo');
var storage = require('../../utils/storage');
var toast = require('../../utils/toast');
var templates = require('../../utils/policy-templates');

// 期限 picker 选项
var COVERAGE_TERM_TYPE_OPTIONS = ['终身', 'N 年', '至 N 岁'];
var COVERAGE_TERM_TYPES = ['lifetime', 'years', 'to_age'];
var PAYMENT_TERM_TYPE_OPTIONS = ['N 年', '一次性', '同保障期'];
var PAYMENT_TERM_TYPES = ['years', 'single', 'same_as_coverage'];

Page({
  data: {
    isEdit: false,
    policyId: null,
    customerId: null,
    customerName: '',

    // 险种（新）
    categoryOptions: templates.CATEGORY_LABELS,
    categoryIndex: 0,
    category: 'critical_illness',

    productName: '',
    premium: '',
    effectiveDate: '',

    // 保障期限
    coverageTerm: { type: 'lifetime', value: null },
    coverageTermTypeOptions: COVERAGE_TERM_TYPE_OPTIONS,
    coverageTermTypeIndex: 0,
    coverageTermDisplay: '',
    coverageTermEditing: false,

    // 缴费期限
    paymentTerm: { type: 'years', value: 20 },
    paymentTermTypeOptions: PAYMENT_TERM_TYPE_OPTIONS,
    paymentTermTypeIndex: 0,
    paymentTermDisplay: '',
    paymentTermEditing: false,
    showPaymentTerm: true,

    // 草稿提示
    showDraftTip: false,
    visitRecordDate: '',

    isSaving: false
  },

  onLoad: function (options) {
    var self = this;
    storage.waitReady().then(function () {
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
          var cat = policy.category || templates.inferCategoryFromProductType(policy.product_type || '');
          var catIdx = templates.CATEGORY_OPTIONS.indexOf(cat);
          if (catIdx < 0) catIdx = 0;
          var tmpl = templates.getTemplate(cat);
          var ct = policy.coverage_term || tmpl.coverage_term;
          var pt = policy.payment_term || tmpl.payment_term;
          var ctTypeIdx = COVERAGE_TERM_TYPES.indexOf(ct.type);
          var ptTypeIdx = PAYMENT_TERM_TYPES.indexOf(pt.type);

          self.setData({
            isEdit: true,
            policyId: policyId,
            customerId: customerId,
            category: cat,
            categoryIndex: catIdx,
            productName: policy.product_name || '',
            premium: policy.premium ? String(policy.premium) : '',
            effectiveDate: policy.effective_date || '',
            coverageTerm: ct,
            coverageTermTypeIndex: ctTypeIdx >= 0 ? ctTypeIdx : 0,
            paymentTerm: pt,
            paymentTermTypeIndex: ptTypeIdx >= 0 ? ptTypeIdx : 0,
            showPaymentTerm: tmpl.show_payment_term
          });
          self._updateTermDisplays();
          wx.setNavigationBarTitle({ title: '编辑保单' });
        }
      } else {
        // 新建模式
        var customer = customerRepo.get(customerId);
        var defaultCat = 'critical_illness';
        var defaultTmpl = templates.getTemplate(defaultCat);

        self.setData({
          customerId: customerId,
          customerName: customer ? customer.name : '',
          category: defaultCat,
          categoryIndex: templates.CATEGORY_OPTIONS.indexOf(defaultCat),
          coverageTerm: defaultTmpl.coverage_term,
          paymentTerm: defaultTmpl.payment_term,
          showPaymentTerm: defaultTmpl.show_payment_term
        });
        self._updateTermDisplays();

        // 草稿衔接：来自拜访记录
        var visitRecordId = options.visit_record_id ? parseInt(options.visit_record_id) : null;
        if (visitRecordId !== null) {
          try {
            var records = storage.getTable('visit_record');
            for (var j = 0; j < records.length; j++) {
              if (records[j].id === visitRecordId) {
                self.setData({
                  showDraftTip: true,
                  visitRecordDate: records[j].date || ''
                });
                break;
              }
            }
          } catch (e) { /* 不影响主流程 */ }
        }

        wx.setNavigationBarTitle({ title: '添加保单' });
      }
    });
  },

  // 险种切换
  onCategoryChange: function (e) {
    var idx = parseInt(e.detail.value);
    var cat = templates.CATEGORY_OPTIONS[idx];
    var tmpl = templates.getTemplate(cat);
    var ctTypeIdx = COVERAGE_TERM_TYPES.indexOf(tmpl.coverage_term.type);
    var ptTypeIdx = PAYMENT_TERM_TYPES.indexOf(tmpl.payment_term.type);

    this.setData({
      category: cat,
      categoryIndex: idx,
      coverageTerm: tmpl.coverage_term,
      coverageTermTypeIndex: ctTypeIdx >= 0 ? ctTypeIdx : 0,
      paymentTerm: tmpl.payment_term,
      paymentTermTypeIndex: ptTypeIdx >= 0 ? ptTypeIdx : 0,
      showPaymentTerm: tmpl.show_payment_term
    });
    this._updateTermDisplays();
  },

  onProductNameInput: function (e) {
    this.setData({ productName: e.detail.value });
  },

  onPremiumInput: function (e) {
    this.setData({ premium: e.detail.value });
  },

  onEffectiveDateChange: function (e) {
    this.setData({ effectiveDate: e.detail.value });
  },

  // 保障期限折叠切换
  onToggleCoverageTermEdit: function () {
    this.setData({ coverageTermEditing: !this.data.coverageTermEditing });
  },

  onCoverageTermTypeChange: function (e) {
    var idx = parseInt(e.detail.value);
    var type = COVERAGE_TERM_TYPES[idx];
    var ct = { type: type, value: this.data.coverageTerm.value };
    if (type === 'lifetime') ct.value = null;
    this.setData({ coverageTerm: ct, coverageTermTypeIndex: idx });
    this._updateTermDisplays();
  },

  onCoverageTermValueInput: function (e) {
    var val = parseInt(e.detail.value) || null;
    var ct = { type: this.data.coverageTerm.type, value: val };
    this.setData({ coverageTerm: ct });
    this._updateTermDisplays();
  },

  // 缴费期限折叠切换
  onTogglePaymentTermEdit: function () {
    this.setData({ paymentTermEditing: !this.data.paymentTermEditing });
  },

  onPaymentTermTypeChange: function (e) {
    var idx = parseInt(e.detail.value);
    var type = PAYMENT_TERM_TYPES[idx];
    var pt = { type: type, value: this.data.paymentTerm.value };
    if (type === 'single' || type === 'same_as_coverage') pt.value = null;
    this.setData({ paymentTerm: pt, paymentTermTypeIndex: idx });
    this._updateTermDisplays();
  },

  onPaymentTermValueInput: function (e) {
    var val = parseInt(e.detail.value) || null;
    var pt = { type: this.data.paymentTerm.type, value: val };
    this.setData({ paymentTerm: pt });
    this._updateTermDisplays();
  },

  _updateTermDisplays: function () {
    this.setData({
      coverageTermDisplay: templates.formatCoverageTerm(this.data.coverageTerm),
      paymentTermDisplay: templates.formatPaymentTerm(this.data.paymentTerm)
    });
  },

  onSave: function () {
    if (this._saving) return;
    this._saving = true;
    this.setData({ isSaving: true });

    var d = this.data;

    if (!d.category) {
      wx.showToast({ title: '请选择险种', icon: 'none' });
      this._saving = false;
      this.setData({ isSaving: false });
      return;
    }
    if (!d.productName || !d.productName.trim()) {
      wx.showToast({ title: '请填写产品名称', icon: 'none' });
      this._saving = false;
      this.setData({ isSaving: false });
      return;
    }
    if (!d.effectiveDate) {
      wx.showToast({ title: '请选择生效日期', icon: 'none' });
      this._saving = false;
      this.setData({ isSaving: false });
      return;
    }
    if (!d.premium || isNaN(parseFloat(d.premium))) {
      wx.showToast({ title: '请填写保费金额', icon: 'none' });
      this._saving = false;
      this.setData({ isSaving: false });
      return;
    }

    var coverageKey = templates.getCoverageKey(d.category);

    try {
      if (d.isEdit) {
        var fields = {
          product_name: d.productName,
          category: d.category,
          product_type: coverageKey,
          premium: parseFloat(d.premium),
          effective_date: d.effectiveDate,
          expire_date: null,
          coverage_term: d.coverageTerm,
          payment_term: d.paymentTerm,
          status: 'active'
        };
        policyRepo.update(d.policyId, fields);

        var statusUpdate = {};
        statusUpdate[coverageKey] = 'configured';
        customerRepo.update(d.customerId, { coverage_status: statusUpdate, _forceStatus: true });
      } else {
        policyRepo.create({
          customer_id: d.customerId,
          category: d.category,
          product_type: coverageKey,
          product_name: d.productName,
          premium: parseFloat(d.premium),
          effective_date: d.effectiveDate,
          expire_date: null,
          coverage_term: d.coverageTerm,
          payment_term: d.paymentTerm,
          status: 'active',
          visit_record_id: null
        });

        var statusUpdate2 = {};
        statusUpdate2[coverageKey] = 'configured';
        customerRepo.update(d.customerId, { coverage_status: statusUpdate2, _forceStatus: true });

        logRepo.add({
          customer_id: d.customerId,
          field: 'policy',
          old_value: '',
          new_value: d.category + ' added'
        });
      }

      toast.success('已保存');
      setTimeout(function () { wx.navigateBack(); }, 600);
    } catch (e) {
      toast.fail(e.message || '保存失败');
      this._saving = false;
      this.setData({ isSaving: false });
    }
  }
});

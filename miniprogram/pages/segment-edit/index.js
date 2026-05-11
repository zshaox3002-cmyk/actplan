/**
 * segment-edit/index.js — 客户视图编辑器（v1.1 新增）
 * 支持新建和编辑模式，底部实时预览命中数（防抖 300ms）
 */

var segmentRepo = require('../../utils/repository/segment.repo');
var customerRepo = require('../../utils/repository/customer.repo');
var policyRepo = require('../../utils/repository/policy.repo');
var planRepo = require('../../utils/repository/plan.repo');
var segmentEngine = require('../../utils/segment');
var storage = require('../../utils/storage');
var toast = require('../../utils/toast');

var INTIMACY_OPTIONS = ['陌生', '普通朋友', '熟人', '好友', '亲密'];
var COVERAGE_TYPES = ['重疾', '医疗', '教育金', '养老', '意外', '寿险'];
var COVERAGE_STATUS_OPTIONS = ['gap', 'configured', 'none', 'unknown'];
var STAGE_OPTIONS = ['初步认识', '需求沟通', '方案讲解', '待促成', '已成交', '已流失'];
var COLOR_OPTIONS = ['gold', 'purple', 'blue', 'green', 'gray'];
var COLOR_LABELS = { gold: '金', purple: '紫', blue: '蓝', green: '绿', gray: '灰' };

var OP_LABELS = { gte: '≥', lte: '≤', eq: '=', neq: '≠', within: '临近' };
var COVERAGE_STATUS_LABELS = { gap: '有缺口', configured: '已配置', none: '不需要', unknown: '未知' };

var FIELD_OPTIONS = [
  { key: 'stage', label: '跟进阶段', type: 'enum', options: STAGE_OPTIONS },
  { key: 'intimacy', label: '关系亲密度', type: 'intimacy' },
  { key: 'is_hnw', label: '高净值客户', type: 'bool' },
  { key: 'policy_count', label: '已成交保单数', type: 'number' },
  { key: 'total_premium', label: '累计保费', type: 'number' },
  { key: 'avg_premium', label: '件均保费', type: 'number' },
  { key: 'coverage_status_any', label: '保障状态（任一险种）', type: 'coverage_status' },
  { key: 'days_since_last_visit', label: '距上次拜访天数', type: 'number' },
  { key: 'days_to_next_plan', label: '距下次计划天数', type: 'number' },
  { key: 'birthday_within_days', label: '生日临近', type: 'within_days' },
  { key: 'policy_expire_within_days', label: '保单到期临近', type: 'within_days' },
  { key: 'age_range', label: '年龄段', type: 'enum', options: ['25岁以下', '25–34岁', '35–44岁', '45–54岁', '55–64岁', '65岁以上'] },
  { key: 'gender', label: '性别', type: 'enum', options: ['男', '女', '未知'] },
  { key: 'income', label: '收入', type: 'enum', options: ['10万以下', '10–30万', '30–50万', '50–100万', '100–300万', '300万以上', '未知'] }
];

var SORT_FIELD_OPTIONS = [
  { key: 'total_premium', label: '累计保费' },
  { key: 'policy_count', label: '已成交保单数' },
  { key: 'avg_premium', label: '件均保费' },
  { key: 'days_since_last_visit', label: '距上次拜访天数' },
  { key: 'intimacy', label: '关系亲密度' },
  { key: 'created_at', label: '创建时间' }
];

Page({
  data: {
    isEdit: false,
    segmentId: null,
    isSystem: false,

    name: '',
    color: 'gold',
    colorOptions: COLOR_OPTIONS,
    colorLabels: COLOR_LABELS,
    rules: [],          // [{ field, op, value, _fieldLabel, _opLabel, _valueLabel }]
    ruleMatch: 'AND',   // 系统预设规则逻辑类型展示用
    sortField: 'total_premium',
    sortFieldLabel: '累计保费',
    sortOrder: 'desc',

    fieldOptions: FIELD_OPTIONS,
    sortFieldOptions: SORT_FIELD_OPTIONS,

    // 预览
    previewCount: 0,
    previewCustomers: [],
    showPreview: false,

    // 规则编辑弹窗
    showRuleEditor: false,
    editingRuleIndex: -1,   // -1 = 新增
    ruleField: '',
    ruleFieldLabel: '',
    ruleOp: 'gte',
    ruleOpLabel: '≥',
    ruleValue: '',
    ruleFieldType: '',
    ruleOpOptions: [],
    ruleValueOptions: [],

    // 保存防重复
    isSaving: false
  },

  _previewTimer: null,
  _enrichedAll: null,

  onLoad: function (options) {
    var that = this;
    var id = (options.id !== undefined && options.id !== '') ? parseInt(options.id) : null;

    storage.waitReady().then(function () {
      if (id !== null) {
        var all = segmentRepo.listAll();
        var seg = null;
        for (var i = 0; i < all.length; i++) {
          if (all[i].id === id) { seg = all[i]; break; }
        }
        if (seg) {
          that.setData({
            isEdit: true,
            segmentId: id,
            isSystem: seg.is_system,
            name: seg.name,
            color: seg.color || 'gold',
            rules: that._deserializeRules(seg.rules ? seg.rules.rules : []),
            ruleMatch: seg.rules && seg.rules.match ? seg.rules.match : 'AND',
            sortField: seg.sort ? seg.sort.field : 'total_premium',
            sortFieldLabel: (function (key) {
              for (var i = 0; i < SORT_FIELD_OPTIONS.length; i++) {
                if (SORT_FIELD_OPTIONS[i].key === key) return SORT_FIELD_OPTIONS[i].label;
              }
              return key;
            })(seg.sort ? seg.sort.field : 'total_premium'),
            sortOrder: seg.sort ? seg.sort.order : 'desc'
          });
          wx.setNavigationBarTitle({ title: seg.is_system ? '查看规则' : '编辑视图' });
        }
      } else {
        wx.setNavigationBarTitle({ title: '新建视图' });
      }

      that._loadEnriched();
    });
  },

  _loadEnriched: function () {
    var that = this;
    var allCustomers = customerRepo.list({});
    var derivedMap = policyRepo.getDerivedAll();
    var allPlans = planRepo.listAll();
    var today = new Date();
    var todayStr = today.getFullYear() + '-' +
      String(today.getMonth() + 1).padStart(2, '0') + '-' +
      String(today.getDate()).padStart(2, '0');

    that._enrichedAll = allCustomers.map(function (c) {
      var nextPlan = null;
      for (var i = 0; i < allPlans.length; i++) {
        var p = allPlans[i];
        if (p.customer_id === c.id && p.status === '待执行') {
          if (!nextPlan || p.plan_date < nextPlan.plan_date) nextPlan = p;
        }
      }
      var derived = derivedMap[c.id] || { policy_count: 0, total_premium: 0, avg_premium: 0, first_policy_date: null };
      return Object.assign({}, c, derived, {
        _nextFollowDate: nextPlan ? nextPlan.plan_date : null
      });
    });

    that._updatePreview();
  },

  /** 将存储的 rules 数组反序列化为带展示标签的格式 */
  _deserializeRules: function (rules) {
    return (rules || []).map(function (r) {
      // 嵌套子组（如 OR 条件）：展示为摘要文本，不可单独编辑
      if (r.match && r.rules) {
        var subLabels = r.rules.map(function (sub) {
          var fieldDef = null;
          for (var i = 0; i < FIELD_OPTIONS.length; i++) {
            if (FIELD_OPTIONS[i].key === sub.field) { fieldDef = FIELD_OPTIONS[i]; break; }
          }
          return (fieldDef ? fieldDef.label : sub.field) + ' ' + (OP_LABELS[sub.op] || sub.op) + ' ' + sub.value;
        });
        return {
          _isGroup: true,
          _fieldLabel: '(' + subLabels.join(' ' + r.match + ' ') + ')',
          _opLabel: '',
          _valueLabel: '',
          field: '__group__', op: 'eq', value: ''
        };
      }
      var fieldDef = null;
      for (var i = 0; i < FIELD_OPTIONS.length; i++) {
        if (FIELD_OPTIONS[i].key === r.field) { fieldDef = FIELD_OPTIONS[i]; break; }
      }
      var fieldLabel = fieldDef ? fieldDef.label : r.field;
      var opLabel = OP_LABELS[r.op] || r.op;
      var valueLabel = String(r.value);
      if (fieldDef && fieldDef.type === 'intimacy') {
        valueLabel = INTIMACY_OPTIONS[parseInt(r.value) - 1] || valueLabel;
      } else if (fieldDef && fieldDef.type === 'coverage_status') {
        valueLabel = COVERAGE_STATUS_LABELS[r.value] || valueLabel;
      } else if (fieldDef && fieldDef.type === 'bool') {
        valueLabel = r.value === true || r.value === 'true' ? '是' : '否';
      } else if (fieldDef && fieldDef.type === 'within_days') {
        valueLabel = r.value + '天内';
      }
      return Object.assign({}, r, { _fieldLabel: fieldLabel, _opLabel: opLabel, _valueLabel: valueLabel });
    });
  },

  _updatePreview: function () {
    var that = this;
    if (this._previewTimer) clearTimeout(this._previewTimer);
    this._previewTimer = setTimeout(function () {
      if (!that._enrichedAll) return;
      var rulesJson = that._buildRulesJson();
      var matched = segmentEngine.applySegment(that._enrichedAll, rulesJson, null);
      var preview = matched.slice(0, 5).map(function (c) {
        return { id: c.id, name: c.name, stage: c.stage };
      });
      that.setData({ previewCount: matched.length, previewCustomers: preview });
    }, 300);
  },

  _buildRulesJson: function () {
    var rules = this.data.rules.map(function (r) {
      return { field: r.field, op: r.op, value: r.value };
    });
    return { version: 1, match: 'AND', rules: rules };
  },

  onNameInput: function (e) {
    this.setData({ name: e.detail.value });
  },

  onColorTap: function (e) {
    this.setData({ color: e.currentTarget.dataset.color });
  },

  onSortFieldChange: function (e) {
    var idx = parseInt(e.detail.value);
    this.setData({ sortField: SORT_FIELD_OPTIONS[idx].key, sortFieldLabel: SORT_FIELD_OPTIONS[idx].label });
  },

  onSortOrderToggle: function () {
    this.setData({ sortOrder: this.data.sortOrder === 'desc' ? 'asc' : 'desc' });
  },

  onAddRule: function () {
    if (this.data.rules.length >= 8) {
      wx.showToast({ title: '最多添加 8 条规则', icon: 'none' });
      return;
    }
    var firstField = FIELD_OPTIONS[0];
    var opOptions = this._getOpOptions(firstField.type);
    this.setData({
      showRuleEditor: true,
      editingRuleIndex: -1,
      ruleField: firstField.key,
      ruleFieldLabel: firstField.label,
      ruleOp: opOptions[0].key,
      ruleOpLabel: opOptions[0].label,
      ruleValue: '',
      ruleFieldType: firstField.type,
      ruleOpOptions: opOptions,
      ruleValueOptions: this._getValueOptions(firstField)
    });
  },

  onEditRule: function (e) {
    var idx = parseInt(e.currentTarget.dataset.index);
    var rule = this.data.rules[idx];
    var fieldDef = this._getFieldDef(rule.field);
    var opOptions = this._getOpOptions(fieldDef ? fieldDef.type : 'number');
    var currentOp = opOptions.filter(function (o) { return o.key === rule.op; })[0] || opOptions[0];
    this.setData({
      showRuleEditor: true,
      editingRuleIndex: idx,
      ruleField: rule.field,
      ruleFieldLabel: fieldDef ? fieldDef.label : rule.field,
      ruleOp: rule.op,
      ruleOpLabel: currentOp.label,
      ruleValue: String(rule.value),
      ruleFieldType: fieldDef ? fieldDef.type : 'number',
      ruleOpOptions: opOptions,
      ruleValueOptions: fieldDef ? this._getValueOptions(fieldDef) : []
    });
  },

  onDeleteRule: function (e) {
    var idx = parseInt(e.currentTarget.dataset.index);
    var rules = this.data.rules.slice();
    rules.splice(idx, 1);
    this.setData({ rules: rules });
    this._updatePreview();
  },

  onRuleFieldChange: function (e) {
    var idx = parseInt(e.detail.value);
    var fieldDef = FIELD_OPTIONS[idx];
    var opOptions = this._getOpOptions(fieldDef.type);
    this.setData({
      ruleField: fieldDef.key,
      ruleFieldLabel: fieldDef.label,
      ruleFieldType: fieldDef.type,
      ruleOp: opOptions[0].key,
      ruleOpLabel: opOptions[0].label,
      ruleValue: '',
      ruleOpOptions: opOptions,
      ruleValueOptions: this._getValueOptions(fieldDef)
    });
  },

  onRuleOpChange: function (e) {
    var ops = this.data.ruleOpOptions;
    var selected = ops[parseInt(e.detail.value)];
    this.setData({ ruleOp: selected.key, ruleOpLabel: selected.label });
  },

  onRuleValueInput: function (e) {
    this.setData({ ruleValue: e.detail.value });
  },

  onRuleValueSelect: function (e) {
    this.setData({ ruleValue: e.currentTarget.dataset.val });
  },

  onRuleEditorConfirm: function () {
    var field = this.data.ruleField;
    var op = this.data.ruleOp;
    var rawVal = this.data.ruleValue;

    if (!field || !op || rawVal === '' || rawVal === null || rawVal === undefined) {
      wx.showToast({ title: '请填写完整规则', icon: 'none' });
      return;
    }

    // 类型转换
    var value = rawVal;
    var fieldDef = this._getFieldDef(field);
    if (fieldDef && (fieldDef.type === 'number' || fieldDef.type === 'within_days')) {
      value = parseFloat(rawVal);
      if (isNaN(value)) {
        wx.showToast({ title: '请输入有效数字', icon: 'none' });
        return;
      }
    } else if (fieldDef && fieldDef.type === 'intimacy') {
      value = parseInt(rawVal);
    } else if (fieldDef && fieldDef.type === 'bool') {
      value = rawVal === 'true' || rawVal === true;
    }

    var rule = { field: field, op: op, value: value };

    // 计算展示标签
    var fieldLabel = this.data.ruleFieldLabel || field;
    var opLabel = OP_LABELS[op] || op;
    var valueLabel = String(value);
    if (fieldDef && fieldDef.type === 'intimacy') {
      valueLabel = INTIMACY_OPTIONS[parseInt(value) - 1] || valueLabel;
    } else if (fieldDef && fieldDef.type === 'coverage_status') {
      valueLabel = COVERAGE_STATUS_LABELS[value] || valueLabel;
    } else if (fieldDef && fieldDef.type === 'bool') {
      valueLabel = value === true || value === 'true' ? '是' : '否';
    } else if (fieldDef && fieldDef.type === 'within_days') {
      valueLabel = value + '天内';
    }
    rule._fieldLabel = fieldLabel;
    rule._opLabel = opLabel;
    rule._valueLabel = valueLabel;

    var rules = this.data.rules.slice();
    if (this.data.editingRuleIndex >= 0) {
      rules[this.data.editingRuleIndex] = rule;
    } else {
      rules.push(rule);
    }

    this.setData({ rules: rules, showRuleEditor: false });
    this._updatePreview();
  },

  onRuleEditorCancel: function () {
    this.setData({ showRuleEditor: false });
  },

  onTogglePreview: function () {
    this.setData({ showPreview: !this.data.showPreview });
  },

  onSave: function () {
    if (this._saving) return;
    this._saving = true;
    this.setData({ isSaving: true });

    var name = (this.data.name || '').trim();
    if (!name) {
      wx.showToast({ title: '请填写视图名称', icon: 'none' });
      this._saving = false;
      this.setData({ isSaving: false });
      return;
    }
    if (name.length > 12) {
      wx.showToast({ title: '视图名最长 12 字', icon: 'none' });
      this._saving = false;
      this.setData({ isSaving: false });
      return;
    }

    var rulesJson = this._buildRulesJson();
    var sortJson = { field: this.data.sortField, order: this.data.sortOrder };

    try {
      if (this.data.isEdit) {
        segmentRepo.update(this.data.segmentId, {
          name: this.data.isSystem ? undefined : name,
          color: this.data.isSystem ? undefined : this.data.color,
          rules: rulesJson,
          sort: sortJson
        });
      } else {
        segmentRepo.create({ name: name, color: this.data.color, rules: rulesJson, sort: sortJson });
      }
      toast.success('已保存');
      setTimeout(function () { wx.navigateBack(); }, 600);
    } catch (e) {
      toast.fail(e.message || '保存失败');
      this._saving = false;
      this.setData({ isSaving: false });
    }
  },

  _getFieldDef: function (key) {
    for (var i = 0; i < FIELD_OPTIONS.length; i++) {
      if (FIELD_OPTIONS[i].key === key) return FIELD_OPTIONS[i];
    }
    return null;
  },

  _getOpOptions: function (type) {
    var keys;
    if (type === 'enum' || type === 'coverage_status' || type === 'bool') keys = ['eq', 'neq'];
    else if (type === 'intimacy') keys = ['gte', 'lte', 'eq'];
    else if (type === 'within_days') keys = ['within'];
    else keys = ['gte', 'lte', 'eq'];
    return keys.map(function (k) { return { key: k, label: OP_LABELS[k] || k }; });
  },

  _getValueOptions: function (fieldDef) {
    if (!fieldDef) return [];
    if (fieldDef.type === 'enum') return fieldDef.options || [];
    if (fieldDef.type === 'intimacy') return INTIMACY_OPTIONS.map(function (l, i) { return { label: l, value: i + 1 }; });
    if (fieldDef.type === 'coverage_status') return COVERAGE_STATUS_OPTIONS.map(function (k) { return { label: COVERAGE_STATUS_LABELS[k] || k, value: k }; });
    if (fieldDef.type === 'bool') return [{ label: '是', value: 'true' }, { label: '否', value: 'false' }];
    if (fieldDef.type === 'within_days') return [{ label: '30天内', value: 30 }, { label: '60天内', value: 60 }, { label: '90天内', value: 90 }];
    return [];
  }
});

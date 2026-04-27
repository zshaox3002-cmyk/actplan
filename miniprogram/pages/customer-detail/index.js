/**
 * customer-detail/index.js — 客户详情页
 * 功能：查看态 + 整页编辑态切换
 * - 编辑态中自动写入字段置灰
 * - 苹果等级由用户手动选择（不再自动计算）
 * - 所有枚举字段改为 inline-picker 下拉选择
 * - 返回拦截：编辑态点返回弹出确认弹窗
 */

var customerRepo = require('../../utils/repository/customer.repo');
var logRepo = require('../../utils/repository/log.repo');
/* DISABLED: apple-auto-grade - 改为用户手动打标，不再自动计算
var appleRank = require('../../utils/apple-rank');
*/
var toast = require('../../utils/toast');

/**
 * 通用：从 options 数组中查找 value 对应的 index
 * @param {Array} options - 选项数组（字符串数组）
 * @param {*} value - 待查找的值
 * @returns {number} 索引，未找到返回 -1
 */
function findIndex(options, value) {
  if (value == null) return -1;
  var i = options.indexOf(value);
  return i >= 0 ? i : -1;
}

/**
 * 通用：根据 index 从 options 取值，index < 0 返回 null
 * @param {Array} options - 选项数组
 * @param {number} index - 当前选中索引
 * @returns {*} 选中值或 null
 */
function getValue(options, index) {
  return index >= 0 ? options[index] : null;
}

Page({
  data: {
    loading: true,
    isEdit: false,          // 是否处于编辑态
    isNew: false,           // 是否新建客户（预留）
    id: null,               // 客户 ID
    customer: {},           // 客户数据（编辑态工作副本）

    // 编辑态表单数据
    form: {
      name: '',
      stage: '需求沟通',
      coverage_gap: '',
      last_visit: '',
      visit_count: 0
    },

    // 性别
    genderOptions: ['男', '女', '未知'],
    genderIndex: 2,
    // 关系
    relationOptions: ['同事', '朋友', '亲戚', '同学', '邻居', '客户介绍', '陌生拜访', '其他'],
    relationIndex: -1,
    // 收入
    incomeOptions: ['10万以下', '10–30万', '30–50万', '50–100万', '100–300万', '300万以上', '未知'],
    incomeIndex: -1,
    // 年龄范围
    ageRangeOptions: ['25岁以下', '25–34岁', '35–44岁', '45–54岁', '55–64岁', '65岁以上'],
    ageRangeIndex: -1,
    // 职业
    occupationOptions: ['企业职员', '企业管理层', '个体经营', '自由职业', '医疗/教育/公务员', '金融从业者', '工程技术', '全职家庭', '学生', '其他'],
    occupationIndex: -1,
    // 居住类型
    residenceOptions: ['自住房（无贷）', '自住房（有贷）', '租房', '与父母同住', '其他'],
    residenceIndex: -1,
    // 婚姻状况
    maritalOptions: ['未婚', '已婚–无子', '已婚–有子', '离异', '丧偶'],
    maritalIndex: -1,
    // 交情
    intimacyOptions: ['陌生', '普通朋友', '熟人', '好友', '亲密'],
    intimacyIndex: -1,
    // 苹果等级
    appleGradeOptions: [
      { label: '红苹果', value: 'red',     color: '#E74C3C' },
      { label: '青苹果', value: 'green',   color: '#27AE60' },
      { label: '烂苹果', value: 'rotten',  color: '#92400E' },
      { label: '待定',   value: 'pending', color: '#F39C12' }
    ],
    appleGradeIndex: 3,
    // 家庭成员
    familyOptions: ['单身', '夫妻二人', '有未成年子女', '有成年子女', '与父母同住', '三代同堂'],
    familyIndex: -1,
    // 三个判断字段
    hasNeedOptions:    ['是', '否', '不确定'],
    hasNeedIndex:      2,
    hasAbilityOptions: ['是', '否', '不确定'],
    hasAbilityIndex:   2,
    isDeciderOptions:  ['是', '否', '不确定'],
    isDeciderIndex:    2,

    // 跟进阶段
    stageOptions: ['需求沟通', '方案呈现', '异议处理', '促成签单', '已成交', '已拒绝'],
    stageIndex: -1
  },

  onLoad: function (options) {
    if (options && options.id) {
      var id = parseInt(options.id);
      var customer = customerRepo.get(id);
      if (customer) {
        // 一次性合并所有初始数据，避免连续 setData 导致渲染框架错误
        var initData = {
          id: customer.id,
          customer: customer,
          isNew: false,
          isEdit: true,
          loading: false
        };

        // 计算 apple grade index
        var appleIdx = 3; // 默认"待定"
        for (var i = 0; i < this.data.appleGradeOptions.length; i++) {
          if (this.data.appleGradeOptions[i].value === (customer.apple_grade || '')) {
            appleIdx = i;
            break;
          }
        }

        // 合并 _loadIndices 的数据
        initData.form = {
          name: customer.name || '',
          stage: customer.stage || '需求沟通',
          coverage_gap: customer.coverage_gap || '',
          last_visit: customer.last_visit || '',
          visit_count: customer.visit_count || 0
        };
        initData.genderIndex     = findIndex(this.data.genderOptions,     customer.gender);
        initData.relationIndex   = findIndex(this.data.relationOptions,   customer.relation);
        initData.incomeIndex     = findIndex(this.data.incomeOptions,     customer.income);
        initData.ageRangeIndex   = findIndex(this.data.ageRangeOptions,   customer.age_range);
        initData.occupationIndex = findIndex(this.data.occupationOptions, customer.occupation);
        initData.residenceIndex  = findIndex(this.data.residenceOptions,  customer.residence);
        initData.maritalIndex    = findIndex(this.data.maritalOptions,    customer.marital);
        initData.intimacyIndex   = findIndex(this.data.intimacyOptions,   customer.intimacy);
        initData.appleGradeIndex = appleIdx;
        initData.familyIndex     = findIndex(this.data.familyOptions,     customer.family);
        initData.hasNeedIndex    = findIndex(this.data.hasNeedOptions,    customer.has_need);
        initData.hasAbilityIndex = findIndex(this.data.hasAbilityOptions, customer.has_ability);
        initData.isDeciderIndex  = findIndex(this.data.isDeciderOptions,  customer.is_decider);
        initData.stageIndex      = findIndex(this.data.stageOptions,      customer.stage);

        this.setData(initData);

        // 进入即编辑态，启用返回拦截
        wx.enableAlertBeforeUnload({
          message: '当前有未保存的修改，确认放弃？'
        });
      } else {
        toast.fail('客户不存在');
        setTimeout(function () { wx.navigateBack(); }, 1500);
      }
    } else {
      // 新建客户模式
      this.setData({
        isNew: true,
        isEdit: true,
        loading: false
      });
      // 启用返回拦截
      wx.enableAlertBeforeUnload({
        message: '当前有未保存的修改，确认放弃？'
      });
    }
  },

  onUnload: function () {
    wx.disableAlertBeforeUnload();
  },

  /**
   * 从客户数据回填所有 picker index
   * @param {Object} c - 客户数据
   */
  _loadIndices: function (c) {
    var appleIdx = 3; // 默认"待定"
    for (var i = 0; i < this.data.appleGradeOptions.length; i++) {
      if (this.data.appleGradeOptions[i].value === (c.apple_grade || '')) {
        appleIdx = i;
        break;
      }
    }

    this.setData({
      form: {
        name: c.name || '',
        stage: c.stage || '需求沟通',
        coverage_gap: c.coverage_gap || '',
        last_visit: c.last_visit || '',
        visit_count: c.visit_count || 0
      },
      genderIndex:     findIndex(this.data.genderOptions,     c.gender),
      relationIndex:   findIndex(this.data.relationOptions,   c.relation),
      incomeIndex:     findIndex(this.data.incomeOptions,     c.income),
      ageRangeIndex:   findIndex(this.data.ageRangeOptions,   c.age_range),
      occupationIndex: findIndex(this.data.occupationOptions, c.occupation),
      residenceIndex:  findIndex(this.data.residenceOptions,  c.residence),
      maritalIndex:    findIndex(this.data.maritalOptions,    c.marital),
      intimacyIndex:   findIndex(this.data.intimacyOptions,   c.intimacy),
      appleGradeIndex: appleIdx,
      familyIndex:     findIndex(this.data.familyOptions,     c.family),
      hasNeedIndex:    findIndex(this.data.hasNeedOptions,    c.has_need),
      hasAbilityIndex: findIndex(this.data.hasAbilityOptions, c.has_ability),
      isDeciderIndex:  findIndex(this.data.isDeciderOptions,  c.is_decider),
      stageIndex:      findIndex(this.data.stageOptions,      c.stage)
    });
  },

  /** 点击右上角"编辑"按钮 */
  onEditTap: function () {
    this.setData({ isEdit: true });
    // 启用返回拦截
    wx.enableAlertBeforeUnload({
      message: '当前有未保存的修改，确认放弃？'
    });
  },

  /** 表单字段变化（用于 input / textarea） */
  onFieldChange: function (e) {
    var field = e.currentTarget.dataset.field;
    var value = e.detail.value;
    var update = {};
    update['form.' + field] = value;
    this.setData(update);
  },

  // ---- Inline-Picker change handlers ----

  onGenderChange: function (e)     { this.setData({ genderIndex:     e.detail.value }); },
  onRelationChange: function (e)   { this.setData({ relationIndex:   e.detail.value }); },
  onIncomeChange: function (e)     { this.setData({ incomeIndex:     e.detail.value }); },
  onAgeRangeChange: function (e)   { this.setData({ ageRangeIndex:   e.detail.value }); },
  onOccupationChange: function (e) { this.setData({ occupationIndex: e.detail.value }); },
  onResidenceChange: function (e)  { this.setData({ residenceIndex:  e.detail.value }); },
  onMaritalChange: function (e)    { this.setData({ maritalIndex:    e.detail.value }); },
  onIntimacyChange: function (e)   { this.setData({ intimacyIndex:   e.detail.value }); },
  onAppleGradeChange: function (e) { this.setData({ appleGradeIndex: e.detail.value }); },
  onFamilyChange: function (e)     { this.setData({ familyIndex:     e.detail.value }); },
  onHasNeedChange: function (e)    { this.setData({ hasNeedIndex:    e.detail.value }); },
  onHasAbilityChange: function (e) { this.setData({ hasAbilityIndex: e.detail.value }); },
  onIsDeciderChange: function (e)  { this.setData({ isDeciderIndex:  e.detail.value }); },

  /** 跟进阶段变化 */
  onStageChange: function (e) {
    var index = e.detail.value;
    this.setData({
      stageIndex: index,
      'form.stage': this.data.stageOptions[index] || '需求沟通'
    });
  },

  /** 保存 */
  onSaveTap: function () {
    var form = this.data.form;

    // 必填校验
    if (!form.name || !form.name.trim()) {
      toast.fail('请输入客户姓名');
      return;
    }

    // 从 picker indices 组装客户数据
    var customerData = {
      name:         form.name,
      gender:       getValue(this.data.genderOptions,     this.data.genderIndex),
      relation:     getValue(this.data.relationOptions,   this.data.relationIndex),
      income:       getValue(this.data.incomeOptions,     this.data.incomeIndex),
      age_range:    getValue(this.data.ageRangeOptions,   this.data.ageRangeIndex),
      occupation:   getValue(this.data.occupationOptions, this.data.occupationIndex),
      residence:    getValue(this.data.residenceOptions,  this.data.residenceIndex),
      marital:      getValue(this.data.maritalOptions,    this.data.maritalIndex),
      intimacy:     getValue(this.data.intimacyOptions,   this.data.intimacyIndex),
      apple_grade:  this.data.appleGradeOptions[this.data.appleGradeIndex].value,
      stage:        form.stage,
      family:       getValue(this.data.familyOptions,     this.data.familyIndex),
      has_need:     getValue(this.data.hasNeedOptions,    this.data.hasNeedIndex),
      has_ability:  getValue(this.data.hasAbilityOptions, this.data.hasAbilityIndex),
      is_decider:   getValue(this.data.isDeciderOptions,  this.data.isDeciderIndex),
      coverage_gap: form.coverage_gap
    };

    // 保存前先禁用返回拦截，避免保存后弹窗
    wx.disableAlertBeforeUnload();

    if (this.data.isNew) {
      // 新建
      try {
        customerRepo.create(customerData);
        toast.success('创建成功');
        setTimeout(function () { wx.navigateBack(); }, 1500);
      } catch (e) {
        toast.fail('创建失败：' + e.message);
        // 创建失败，重新启用拦截
        wx.enableAlertBeforeUnload({ message: '当前有未保存的修改，确认放弃？' });
      }
    } else {
      // 更新
      try {
        customerRepo.update(this.data.id, customerData);

        // 刷新页面数据
        var updated = customerRepo.get(this.data.id);
        this.setData({
          customer: updated,
          isEdit: false
        });
        this._loadIndices(updated);
        toast.success('保存成功');
      } catch (e) {
        toast.fail('保存失败：' + e.message);
        // 保存失败，重新启用拦截
        wx.enableAlertBeforeUnload({ message: '当前有未保存的修改，确认放弃？' });
      }
    }
  },

  /** 删除客户 */
  onDeleteTap: function () {
    var self = this;
    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复，确定删除此客户？',
      confirmColor: '#E74C3C',
      success: function (res) {
        if (res.confirm) {
          customerRepo.delete(self.data.id);
          toast.success('已删除');
          setTimeout(function () { wx.navigateBack(); }, 1500);
        }
      }
    });
  }
});

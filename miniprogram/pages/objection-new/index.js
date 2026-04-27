/**
 * objection-new/index.js — 新建异议页
 *
 * 严格按 PRD 3.5.3 四步骤流程：
 * Step 0: 选择关联客户
 * Step 1: 填写异议内容 + 选择分类
 * Step 2: 展示同类已有记录（合并/新建判断）
 * Step 3: 追加备注（合并模式）或 填写话术（新建模式）→ 提交
 *
 * 入口：
 * 1. 异议池 FAB → 无预填
 * 2. 记录页"新增异议" → 通过 EventChannel 预填 customer_id
 */

var objectionRepo = require('../../utils/repository/objection.repo');
var customerRepo = require('../../utils/repository/customer.repo');
var validators = require('../../utils/validators');
var constants = require('../../utils/constants');
var toast = require('../../utils/toast');

Page({
  data: {
    // 步骤
    steps: ['选择客户', '填写异议', '同类合并', '完成提交'],
    currentStep: 0,

    // 客户列表
    customers: [],
    customerKeyword: '',
    isCustomerLocked: false,

    // 表单
    form: {
      customer_id: null,
      customer_name: '',
      content: '',
      category: '',
      solution: '',
      note: ''        // 追加备注（合并模式）
    },

    // 分类选项
    categoryOptions: [],

    // Step 2: 同类已有记录
    sameCategoryList: [],
    selectedObjectionId: null,   // 追加到此条
    mode: 'create',              // 'create'(新建) | 'append'(追加)

    // Step 3 状态
    submitMode: 'create'         // 'create' | 'append'
  },

  onLoad: function (options) {
    var customerId = options.customer_id ? parseInt(options.customer_id) : null;

    this.setData({
      categoryOptions: constants.OBJECTION_CATEGORY_OPTIONS
    });

    // 预填客户（从记录页跳转时）
    if (customerId) {
      var customer = customerRepo.get(customerId);
      if (customer) {
        this.setData({
          'form.customer_id': customerId,
          'form.customer_name': customer.name,
          isCustomerLocked: true,
          currentStep: 1
        });
      }
    } else {
      this._loadCustomers();
    }

    // 通过 EventChannel 接收预填
    var that = this;
    var eventChannel = this.getOpenerEventChannel();
    if (eventChannel) {
      eventChannel.on('preloadCustomer', function (data) {
        if (data.customer_id && data.customer_name) {
          that.setData({
            'form.customer_id': data.customer_id,
            'form.customer_name': data.customer_name,
            isCustomerLocked: true,
            currentStep: 1
          });
        }
      });
    }
  },

  /** 加载客户列表 */
  _loadCustomers: function () {
    var list = customerRepo.list({ keyword: this.data.customerKeyword });
    // 苹果等级 value → 中文标签映射
    var GRADE_LABEL = { 'red': '红苹果', 'green': '青苹果', 'rotten': '烂苹果', 'pending': '待定' };
    for (var i = 0; i < list.length; i++) {
      list[i].apple_rank_label = GRADE_LABEL[list[i].apple_grade] || list[i].apple_rank || '待定';
    }
    this.setData({ customers: list });
  },

  /** 搜索客户 */
  onCustomerSearch: function (e) {
    this.setData({ customerKeyword: e.detail.value });
    this._loadCustomers();
  },

  /** 选择客户 */
  onCustomerSelect: function (e) {
    var id = e.currentTarget.dataset.id;
    var name = e.currentTarget.dataset.name;
    this.setData({
      'form.customer_id': id,
      'form.customer_name': name,
      currentStep: 1
    });
  },

  /** 异议内容变化 */
  onContentChange: function (e) {
    this.setData({ 'form.content': e.detail.value });
  },

  /** 分类 tag-selector 变化 */
  onCategoryChange: function (e) {
    this.setData({ 'form.category': e.detail.value });
  },

  /** 话术变化 */
  onSolutionChange: function (e) {
    this.setData({ 'form.solution': e.detail.value });
  },

  /** 追加备注变化 */
  onNoteChange: function (e) {
    this.setData({ 'form.note': e.detail.value });
  },

  /** 下一步 */
  onNextStep: function () {
    var form = this.data.form;

    if (this.data.currentStep === 0) {
      // 校验客户选择
      if (!form.customer_id) {
        toast.fail('请选择客户');
        return;
      }
      this.setData({ currentStep: 1 });

    } else if (this.data.currentStep === 1) {
      // 校验异议内容和分类
      var err = validators.validate([
        { check: function () { return validators.required(form.content, '异议内容'); } },
        { check: function () { return validators.required(form.category, '异议分类'); } }
      ]);
      if (err) {
        toast.fail(err);
        return;
      }

      // 查询同类已有记录
      var sameCategoryList = objectionRepo.listByCategory(form.category);
      this.setData({
        sameCategoryList: sameCategoryList,
        currentStep: 2
      });

      // 若无同类记录，直接进入新建模式
      if (sameCategoryList.length === 0) {
        this.setData({
          submitMode: 'create',
          currentStep: 3
        });
      }

    } else if (this.data.currentStep === 2) {
      // 已选择合并或新建，进入 Step 3
      this.setData({ currentStep: 3 });
    }
  },

  /** 上一步 */
  onPrevStep: function () {
    if (this.data.currentStep > 0) {
      // Step 3 回到 Step 2 时重置模式
      if (this.data.currentStep === 3 && this.data.sameCategoryList.length > 0) {
        this.setData({
          currentStep: 2,
          submitMode: 'create',
          selectedObjectionId: null
        });
      } else {
        this.setData({ currentStep: this.data.currentStep - 1 });
      }
    }
  },

  /** 选择"追加到此条" */
  onAppendSelect: function (e) {
    var id = e.currentTarget.dataset.id;
    this.setData({
      selectedObjectionId: id,
      submitMode: 'append',
      currentStep: 3
    });
  },

  /** 选择"以上都不是，新建独立记录" */
  onCreateNew: function () {
    this.setData({
      selectedObjectionId: null,
      submitMode: 'create',
      currentStep: 3
    });
  },

  /** 提交 */
  onSubmit: function () {
    var form = this.data.form;

    if (this.data.submitMode === 'append') {
      // 追加模式：校验备注
      var err = validators.validate([
        { check: function () { return validators.required(form.note, '追加备注'); } }
      ]);
      if (err) {
        toast.fail(err);
        return;
      }

      try {
        objectionRepo.appendNote(
          this.data.selectedObjectionId,
          form.customer_id,
          form.note
        );
        toast.success('追加成功');
        setTimeout(function () {
          wx.navigateBack();
        }, 1000);
      } catch (e) {
        toast.fail('追加失败：' + e.message);
      }

    } else {
      // 新建模式：校验话术
      var err2 = validators.validate([
        { check: function () { return validators.required(form.solution, '应对话术'); } }
      ]);
      if (err2) {
        toast.fail(err2);
        return;
      }

      try {
        var newObjId = objectionRepo.create({
          customer_id: form.customer_id,
          content: form.content,
          category: form.category,
          solution: form.solution
        });
        toast.success('新建成功');

        // 通知调用方（如 record-new）异议已创建
        var eventChannel = this.getOpenerEventChannel();
        if (eventChannel && eventChannel.emit) {
          eventChannel.emit('onObjectionCreated', {
            id: newObjId,
            content: form.content,
            category: form.category,
            solution: form.solution
          });
        }

        setTimeout(function () {
          wx.navigateBack();
        }, 1000);
      } catch (e) {
        toast.fail('新建失败：' + e.message);
      }
    }
  }
});

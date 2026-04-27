/**
 * record-new/index.js — 新建拜访记录
 *
 * 入口：URL 带 customer_id + customer_name + plan_id + plan_date + plan_type
 * 客户锁定，单页平铺式表单
 *
 * 字段：
 * - 客户（只读）
 * - 关联计划（只读，仅计划触发时显示）
 * - 沟通摘要（必填，textarea）
 * - 跟进阶段（必填，inline-picker，保存后同步更新客户）
 * - 下次跟进日期（选填，填写后自动创建拜访计划）
 * - 异议记录（选填，可多条）
 */

var recordRepo = require('../../utils/repository/record.repo');
var customerRepo = require('../../utils/repository/customer.repo');
var planRepo = require('../../utils/repository/plan.repo');
var objectionRepo = require('../../utils/repository/objection.repo');
var storage = require('../../utils/storage');
var toast = require('../../utils/toast');

Page({
  data: {
    customerId: '',
    customerName: '',
    planId: '',
    planInfo: '',        // 关联计划展示文字："2026-04-25 面对面"

    summary: '',         // 沟通摘要

    // 跟进阶段（复用 inline-picker，value 为索引）
    stageOptions: ['需求沟通', '方案呈现', '异议处理', '促成签单', '已成交', '已拒绝'],
    stageIndex: 0,

    nextDate: '',        // 下次跟进日期（选填）
    nextDateDisplay: '请选择日期',

    objections: [],      // 已录入异议列表 [{ content, category }]
  },

  // 页面实例属性（不经过 setData，不受序列化影响）
  _justCreatedIds: null,

  onLoad: function (options) {
    // 初始化实例属性
    this._justCreatedIds = [];

    var customerId = options.customer_id ? parseInt(options.customer_id) : '';
    var customerName = options.customer_name || '';
    var planId = options.plan_id ? parseInt(options.plan_id) : '';
    var planDate = options.plan_date || '';
    var planType = options.plan_type || '';
    var planInfo = planDate && planType ? planDate + ' ' + planType : '';

    // 读取客户当前跟进阶段，回填 stageIndex
    var stageIndex = 0;
    if (customerId) {
      var customer = customerRepo.get(customerId);
      if (customer && customer.stage) {
        var idx = this.data.stageOptions.indexOf(customer.stage);
        if (idx >= 0) stageIndex = idx;
      }
      // 如果 customerName 未传，从客户数据取
      if (!customerName && customer) {
        customerName = customer.name || '';
      }
    }

    this.setData({
      customerId: customerId,
      customerName: customerName,
      planId: planId,
      planInfo: planInfo,
      stageIndex: stageIndex,
    });
  },

  /** 沟通摘要输入 */
  onSummaryInput: function (e) {
    this.setData({ summary: e.detail.value });
  },

  /** 跟进阶段变化（inline-picker 返回选中索引） */
  onStageChange: function (e) {
    this.setData({ stageIndex: e.detail.value });
  },

  /** 下次跟进日期变化 */
  onNextDateChange: function (e) {
    var date = e.detail.value;
    this.setData({
      nextDate: date,
      nextDateDisplay: date,
    });
  },

  /** 选择异议 — 跳转异议选择页（预置 + 新建） */
  onAddObjection: function () {
    var that = this;
    // 将当前已选 ids 编码传过去（编辑场景）
    var selectedIds = that.data.objections.map(function (o) { return o.id; });
    var selectedParam = encodeURIComponent(JSON.stringify(selectedIds));

    wx.navigateTo({
      url: '/pages/objection/select/index?selected=' + selectedParam,
      events: {
        onSelected: function (result) {
          // 兼容两种格式：{ items, justCreatedIds } 或 纯数组
          var selected = result.items || result;
          var justCreatedIds = result.justCreatedIds || [];

          // 诊断日志
          console.warn('[RecordNew] onSelected: justCreatedIds=' + JSON.stringify(justCreatedIds));
          console.warn('[RecordNew] onSelected: selected items=' + JSON.stringify(selected.map(function(o) { return o.id; })));

          // 用实例属性存 justCreatedIds（不走 setData，不受序列化影响）
          that._justCreatedIds = justCreatedIds;

          var objections = that.data.objections.slice();
          // 合并选中结果
          for (var i = 0; i < selected.length; i++) {
            // 去重：同一条不重复添加
            var exists = objections.some(function (o) { return o.id === selected[i].id; });
            if (!exists) {
              objections.push(selected[i]);
            }
          }
          that.setData({ objections: objections });
        }
      }
    });
  },

  /** 删除异议 */
  onDeleteObjection: function (e) {
    var index = e.currentTarget.dataset.index;
    var objections = this.data.objections.filter(function (_, i) {
      return i !== index;
    });
    this.setData({ objections: objections });
  },

  /** 保存记录 */
  onSave: function () {
    var d = this.data;
    var summary = (d.summary || '').trim();

    // 必填校验
    if (!summary) {
      wx.showToast({ title: '请填写沟通摘要', icon: 'none' });
      return;
    }

    var selectedStage = d.stageOptions[d.stageIndex];

    try {
      // 捕获页面实例引用，供事务回调内使用
      var justCreatedIds = this._justCreatedIds;

      // 【诊断日志】验证 justCreatedIds 传递链路
      console.warn('[RecordNew] onSave justCreatedIds:', JSON.stringify(justCreatedIds));
      for (var di = 0; di < d.objections.length; di++) {
        var dObj = d.objections[di];
        console.warn('[RecordNew] objection #' + di, 'id=' + dObj.id, 'type=' + typeof dObj.id,
          'inJustCreated=' + (justCreatedIds && justCreatedIds.indexOf(dObj.id) >= 0));
      }

      // 外层事务：保证多步操作原子性，任一失败全部回滚
      storage.transaction(function () {
        // 1. 先处理异议：新建的创建入库收集 id，已有的追加 note 自动 count+1
        var objectionIds = [];
        if (d.objections.length > 0) {
          for (var i = 0; i < d.objections.length; i++) {
            var obj = d.objections[i];
            if (!obj.id) {
              // 新建异议（理论上很少走到，因为 objection-new 已 create）
              var created = objectionRepo.create({
                customer_id: d.customerId,
                content: obj.content || '',
                category: obj.category || '其他',
                solution: obj.solution || ''
              });
              if (created && created.id != null) {
                objectionIds.push(created.id);
              }
            } else if (justCreatedIds && justCreatedIds.indexOf(obj.id) >= 0) {
              // 本次流程刚从 objection-new 新建并入库的异议：
              // create 时已设 customer_id 和 count=1，无需再计数、无需再写 note
              console.warn('[RecordNew] 跳过 appendNote (justCreated): id=' + obj.id);
              objectionIds.push(obj.id);
            } else {
              // 真正的"复用"：用户从异议选择页勾选了一条已存在的历史异议，
              // 此时应写一条追加备注（内部自动 count+1 或写 objection_links）
              console.warn('[RecordNew] 执行 appendNote (existing): id=' + obj.id);
              var autoNote = '在本次拜访中再次遇到该异议'
                + (summary ? '；沟通摘要：' + summary.slice(0, 40)
                   + (summary.length > 40 ? '…' : '') : '');
              objectionRepo.appendNote(obj.id, d.customerId, autoNote);
              objectionIds.push(obj.id);
            }
          }
        }

        // 2. 保存拜访记录（带上 objection_ids）
        recordRepo.create({
          customer_id: d.customerId,
          plan_id: d.planId || null,
          visit_date: new Date().toISOString().slice(0, 10),
          visit_way: '面对面',
          summary: summary,
          stage: selectedStage,
          is_deal: selectedStage === '已成交' ? '签单成交' : '暂未成交',
          next_follow_date: d.nextDate || null,
          has_objection: objectionIds.length > 0 ? 1 : 0,
          objection_ids: objectionIds,
          updated_fields: ['stage']
        });

        // 3. 同步更新客户跟进阶段（recordRepo.create 内部只处理成交状态，这里补充阶段同步）
        customerRepo.update(d.customerId, { stage: selectedStage });

        // 4. 若填写了下次跟进日期，自动创建拜访计划
        if (d.nextDate) {
          planRepo.create({
            customer_id: d.customerId,
            plan_date: d.nextDate,
            visit_way: '面对面',
            note: '由拜访记录自动创建'
          });
        }
      });

      toast.success('记录已保存');
      setTimeout(function () {
        wx.navigateBack();
      }, 800);
    } catch (e) {
      toast.fail('保存失败：' + (e.message || ''));
    }
  }
});

/**
 * plan-card — 拜访计划卡片组件
 * Props:
 *   plan: Object       — 计划数据 { id, customer_id, plan_date, visit_way, status, created_at }
 *   customerName: String — 关联客户姓名
 * Events:
 *   execute — 点击「执行」按钮
 *   delete  — 点击「删除」按钮
 */

Component({
  properties: {
    plan: {
      type: Object,
      value: {}
    },
    customerName: {
      type: String,
      value: ''
    }
  },

  methods: {
    /** 已完成卡片点击 → 查看记录详情 */
    onCardTap: function () {
      if (this.data.plan.status === '已完成') {
        this.triggerEvent('detail', { id: this.data.plan.id });
      }
    },

    /** 执行计划 → 新建拜访记录 */
    onExecute: function () {
      this.triggerEvent('execute', { plan: this.data.plan });
    },

    /** 修改计划 */
    onEdit: function () {
      this.triggerEvent('edit', { id: this.data.plan.id });
    },

    /** 删除计划 */
    onDelete: function () {
      var that = this;
      wx.showModal({
        title: '确认删除',
        content: '删除后不可恢复，是否继续？',
        confirmColor: '#E74C3C',
        success: function (res) {
          if (res.confirm) {
            that.triggerEvent('delete', { id: that.data.plan.id });
          }
        }
      });
    }
  }
});

/**
 * record-card — 拜访记录卡片组件
 * Props:
 *   record: Object       — 记录数据
 *   customerName: String — 关联客户姓名
 * Events:
 *   tap — 卡片点击
 */

Component({
  properties: {
    record: {
      type: Object,
      value: {}
    },
    customerName: {
      type: String,
      value: ''
    }
  },

  methods: {
    onTap: function () {
      this.triggerEvent('tap', { id: this.data.record.id });
    }
  }
});

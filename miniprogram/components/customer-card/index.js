/**
 * customer-card 组件 — V4.0 行动优先型卡片
 * 固定4行：身份区 / 跟进信号区 / 下次跟进 / 最近沟通
 */
Component({
  properties: {
    customer: { type: Object, value: {} },
    viewContext: { type: String, value: 'default' }
  },

  data: {},

  observers: {
    'customer.stage': function (stage) {
      var map = {
        '初步认识': 'meet',
        '需求沟通': 'comm',
        '方案讲解': 'present',
        '待促成':   'closing',
        '已成交':   'deal',
        '已流失':   'lost'
      };
      this.setData({ '_stageClass': map[stage] || 'comm' });
    }
  },

  methods: {
    onCardTap: function (e) {
      this.triggerEvent('tap', { id: e.currentTarget.dataset.id });
    }
  }
});

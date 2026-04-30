/**
 * customer-card 组件 — V2.0 跟进池卡片
 * 展示：优先级标签 + 阶段标签 + 姓名 + 自定义标签 + 上次沟通 + 下次跟进 + 最近摘要 + +计划/+记录
 * 支持左滑删除
 */
Component({
  properties: {
    customer: { type: Object, value: {} }
  },

  data: {
    offsetX: 0,
    startX: 0,
    startY: 0,
    isSwiping: false,
    isOpen: false
  },

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
    _daysAgo: function (dateStr) {
      var then = new Date(dateStr);
      var now = new Date();
      now.setHours(0, 0, 0, 0);
      then.setHours(0, 0, 0, 0);
      return Math.floor((now - then) / (1000 * 60 * 60 * 24));
    },

    onTouchStart: function (e) {
      this.setData({ startX: e.touches[0].clientX, startY: e.touches[0].clientY, isSwiping: false });
    },

    onTouchMove: function (e) {
      var deltaX = e.touches[0].clientX - this.data.startX;
      var deltaY = e.touches[0].clientY - this.data.startY;
      if (!this.data.isSwiping) {
        if (Math.abs(deltaX) < Math.abs(deltaY) * 1.5) return;
        this.setData({ isSwiping: true });
      }
      if (deltaX > 10 && !this.data.isOpen) return;
      var screenWidth = wx.getSystemInfoSync().windowWidth;
      var maxOffsetPx = -140 * screenWidth / 750;
      var rawOffset = this.data.isOpen
        ? Math.max(deltaX - maxOffsetPx, maxOffsetPx)
        : Math.max(deltaX, maxOffsetPx);
      this.setData({ offsetX: rawOffset * 750 / screenWidth });
    },

    onTouchEnd: function () {
      if (!this.data.isSwiping) return;
      if (this.data.offsetX < -70) {
        this.setData({ offsetX: -140, isOpen: true });
      } else {
        this.setData({ offsetX: 0, isOpen: false });
      }
    },

    onCardTap: function (e) {
      if (this.data.isOpen) {
        this.setData({ offsetX: 0, isOpen: false });
        return;
      }
      this.triggerEvent('tap', { id: e.currentTarget.dataset.id });
    },

    onDeleteTap: function (e) {
      var self = this;
      wx.showModal({
        title: '确认删除',
        content: '删除后无法恢复，关联的计划和记录也将一并删除。',
        confirmText: '删除',
        confirmColor: '#EF4444',
        cancelText: '取消',
        success: function (res) {
          if (res.confirm) {
            self.triggerEvent('delete', { id: e.currentTarget.dataset.id });
          } else {
            self.setData({ offsetX: 0, isOpen: false });
          }
        }
      });
    },

    onAddPlan: function (e) {
      this.triggerEvent('addPlan', {
        id: this.properties.customer.id,
        name: this.properties.customer.name
      });
    },

    onAddRecord: function (e) {
      this.triggerEvent('addRecord', {
        id: this.properties.customer.id,
        name: this.properties.customer.name
      });
    },

    closeSwipe: function () {
      if (this.data.isOpen) this.setData({ offsetX: 0, isOpen: false });
    }
  }
});

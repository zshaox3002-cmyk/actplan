/**
 * objection-card — 异议卡片组件
 * 显示：异议摘要（content 前30字）、分类徽章、出现次数、话术预览（solution 前40字）
 * 点击进入异议详情
 * 支持左滑删除
 */

/**
 * 中文分类 → 英文 CSS 类名映射
 * WXSS 不支持中文类名，需要转成英文
 */
var CATEGORY_CLASS_MAP = {
  '价格': 'price',
  '必要性': 'necessity',
  '时机': 'timing',
  '产品对比': 'compare',
  '信任': 'trust',
  '其他': 'other'
};

// 左滑阈值：超过此距离触发打开删除按钮
var SWIPE_THRESHOLD = 70;
// 删除按钮宽度
var DELETE_BTN_WIDTH = 140;

Component({
  properties: {
    objection: {
      type: Object,
      value: {}
    }
  },

  data: {
    categoryClass: 'other',
    showDelete: false
  },

  observers: {
    'objection.category': function (cat) {
      this.setData({
        categoryClass: CATEGORY_CLASS_MAP[cat] || 'other'
      });
    }
  },

  methods: {
    noop: function () {},

    /** 触摸开始 — 记录起始位置 */
    onTouchStart: function (e) {
      // 预置异议禁止左滑删除
      if (this.data.objection.isPreset) return;

      this._startX = e.touches[0].clientX;
      this._startY = e.touches[0].clientY;
      this._moved = false;

      // 如果当前已展开，点击任意处先关闭
      if (this.data.showDelete) {
        this.closeSwipe();
        this._startX = -1; // 标记本次不响应滑动
      }
    },

    /** 触摸移动 — 判断是否有效左滑手势 */
    onTouchMove: function (e) {
      if (!this.data.objection.id) return;

      var currentX = e.touches[0].clientX;
      var currentY = e.touches[0].clientY;
      var dx = currentX - this._startX;
      var dy = Math.abs(currentY - this._startY);

      // 竖向滚动时不触发左滑（防误触）
      if (dy > 20) return;

      // 只允许左滑（负值）
      if (dx < 0 && Math.abs(dx) > 10) {
        this._moved = true;
      }
    },

    /** 触摸结束 — 判断是否触发左滑或关闭 */
    onTouchEnd: function (e) {
      if (!this.data.objection.id || this._startX < 0) return;

      if (this._moved) {
        var endX = e.changedTouches[0].clientX;
        var dx = endX - this._startX;

        if (Math.abs(dx) >= SWIPE_THRESHOLD && dx < 0) {
          // 左滑到位，显示删除按钮
          this.openDelete();
        } else {
          // 未达阈值，关闭
          this.closeSwipe();
        }
      }

      this._startX = null;
    },

    openDelete: function () {
      this.setData({ showDelete: true });
    },

    closeSwipe: function () {
      this.setData({ showDelete: false });
    },

    /** 点击卡片内容区 — 关闭左滑状态后正常跳转 */
    onTapCard: function () {
      if (this.data.showDelete) {
        this.closeSwipe();
        return;
      }
      this.onTap();
    },

    /** 点击进入异议详情 */
    onTap: function () {
      var id = this.data.objection.id;
      if (id) {
        wx.navigateTo({
          url: '/pages/objection-detail/index?id=' + id
        });
      }
    },

    /** 点击删除按钮 — 二次确认 → 冒泡事件给父页面处理 */
    onDeleteTap: function () {
      var that = this;
      var id = that.data.objection.id;
      wx.showModal({
        title: '确认删除',
        content: '删除后无法恢复，确定删除该异议？',
        confirmColor: '#E74C3C',
        success: function (res) {
          if (res.confirm) {
            that.triggerEvent('delete', { id: id });
            that.closeSwipe();
          }
        }
      });
    }
  }
});

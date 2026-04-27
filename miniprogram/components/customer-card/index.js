/**
 * customer-card 组件
 * 左侧色条 + 底色区分苹果等级
 * 三行布局：姓名+阶段 / 拜访·最近 / 信息标签
 * 支持左滑露出删除按钮
 */
Component({
  properties: {
    customer: {
      type: Object,
      value: {}
    }
  },

  data: {
    appleRankClass: 'yellow',
    displayStage: '',
    stageClass: 'need',
    visitLabel: '',
    lastVisitLabel: '',
    infoTags: [],

    // 左滑相关
    offsetX: 0,          // 卡片横向偏移（rpx）
    startX: 0,           // 触摸起点 X（px）
    startY: 0,           // 触摸起点 Y（px）
    isSwiping: false,    // 是否正在横向滑动
    isOpen: false        // 删除按钮是否已展开
  },

  observers: {
    'customer.apple_grade,customer.stage,customer.visit_count,customer.last_visit,customer.occupation,customer.age_range,customer.income,customer.marital': function (apple_grade, stage, visit_count, last_visit, occupation, age_range, income, marital) {
      // ---- 苹果等级 → CSS class ----
      var RANK_MAP = {
        'red': 'red',
        'green': 'green',
        'rotten': 'brown',
        'pending': 'yellow',
        '红苹果': 'red',
        '青苹果': 'green',
        '烂苹果': 'brown',
        '待定': 'yellow'
      };
      var appleRankClass = RANK_MAP[apple_grade] || 'yellow';

      // ---- 跟进阶段 → 显示文字 + CSS class ----
      var STAGE_DISPLAY = {
        'need': '需求沟通',
        'touch': '初步接触',
        'deal': '已成交',
        'reject': '已拒绝',
        '1': '需求沟通',
        '2': '已成交',
        '3': '已拒绝',
        '需求沟通': '需求沟通',
        '初步接触': '初步接触',
        '已成交': '已成交',
        '已拒绝': '已拒绝'
      };
      var STAGE_CLASS = {
        'need': 'need',
        'touch': 'need',
        'deal': 'deal',
        'reject': 'reject',
        '1': 'need',
        '2': 'deal',
        '3': 'reject',
        '需求沟通': 'need',
        '初步接触': 'need',
        '已成交': 'deal',
        '已拒绝': 'reject'
      };
      var stageStr = String(stage || '');
      var displayStage = STAGE_DISPLAY[stageStr] || stageStr || '需求沟通';
      var stageClass = STAGE_CLASS[stageStr] || 'need';

      // ---- 拜访次数标签 ----
      var visitLabel = '';
      if (visit_count > 0) {
        if (visit_count === 1) {
          visitLabel = '首次拜访';
        } else {
          visitLabel = '多次拜访（' + visit_count + '次）';
        }
      } else {
        visitLabel = '暂未拜访';
      }

      // ---- 最近拜访标签 ----
      var lastVisitLabel = '未拜访';
      if (last_visit) {
        var daysDiff = this._daysAgo(last_visit);
        if (daysDiff === 0) {
          lastVisitLabel = '今天';
        } else if (daysDiff === 1) {
          lastVisitLabel = '昨天';
        } else {
          lastVisitLabel = daysDiff + '天前';
        }
      }

      // ---- 第三行信息标签（带单位） ----
      var infoTags = [];
      if (occupation) infoTags.push(occupation);
      if (age_range) {
        infoTags.push(String(age_range).indexOf('岁') !== -1 ? String(age_range) : String(age_range) + '岁');
      }
      if (income) {
        infoTags.push(String(income).indexOf('万') !== -1 ? String(income) : String(income) + '万');
      }
      if (marital) infoTags.push(marital);

      this.setData({
        appleRankClass: appleRankClass,
        displayStage: displayStage,
        stageClass: stageClass,
        visitLabel: visitLabel,
        lastVisitLabel: lastVisitLabel,
        infoTags: infoTags
      });
    }
  },

  methods: {
    /**
     * 计算距离今天多少天
     */
    _daysAgo: function (dateStr) {
      var then = new Date(dateStr);
      var now = new Date();
      now.setHours(0, 0, 0, 0);
      then.setHours(0, 0, 0, 0);
      return Math.floor((now - then) / (1000 * 60 * 60 * 24));
    },

    // ==================== 左滑手势 ====================

    onTouchStart: function (e) {
      this.setData({
        startX: e.touches[0].clientX,
        startY: e.touches[0].clientY,
        isSwiping: false
      });
    },

    onTouchMove: function (e) {
      var deltaX = e.touches[0].clientX - this.data.startX;
      var deltaY = e.touches[0].clientY - this.data.startY;

      // 判断是否横向滑动（水平位移 > 垂直位移的 1.5 倍才认定）
      if (!this.data.isSwiping) {
        if (Math.abs(deltaX) < Math.abs(deltaY) * 1.5) return;
        this.setData({ isSwiping: true });
      }

      // 只处理左滑（deltaX < 0），右滑时如果已展开则允许
      if (deltaX > 10 && !this.data.isOpen) return;

      // 删除按钮宽度 140rpx，px 转 rpx
      var screenWidth = wx.getSystemInfoSync().windowWidth;
      var maxOffsetPx = -140 * screenWidth / 750; // rpx → px
      var rawOffset;

      if (this.data.isOpen) {
        // 已展开状态：以 -160rpx 为基准继续左滑
        rawOffset = Math.max(deltaX - maxOffsetPx, maxOffsetPx);
      } else {
        rawOffset = Math.max(deltaX, maxOffsetPx);
      }

      // px → rpx
      var rpxOffset = rawOffset * 750 / screenWidth;
      this.setData({ offsetX: rpxOffset });
    },

    onTouchEnd: function () {
      if (!this.data.isSwiping) return;

      // 阈值：滑动超过 70rpx（一半）则打开，否则回弹
      if (this.data.offsetX < -70) {
        this.setData({ offsetX: -140, isOpen: true });
      } else {
        this.setData({ offsetX: 0, isOpen: false });
      }
    },

    /** 点击卡片主体 */
    onCardTap: function (e) {
      // 若删除按钮已展开，点击卡片先关闭，不触发跳转
      if (this.data.isOpen) {
        this.setData({ offsetX: 0, isOpen: false });
        return;
      }
      // 正常跳转编辑态
      var id = e.currentTarget.dataset.id;
      this.triggerEvent('tap', { id: id });
    },

    /** 点击删除按钮 */
    onDeleteTap: function (e) {
      var id = e.currentTarget.dataset.id;
      var self = this;
      wx.showModal({
        title: '确认删除',
        content: '删除后无法恢复，该客户的所有拜访记录和关联计划也将一并删除。',
        confirmText: '删除',
        confirmColor: '#E74C3C',
        cancelText: '取消',
        success: function (res) {
          if (res.confirm) {
            self.triggerEvent('delete', { id: id });
          } else {
            // 取消时回弹卡片
            self.setData({ offsetX: 0, isOpen: false });
          }
        }
      });
    },

    /** 外部调用：强制收起删除按钮 */
    closeSwipe: function () {
      if (this.data.isOpen) {
        this.setData({ offsetX: 0, isOpen: false });
      }
    }
  }
});

/**
 * filter-bar 组件
 * 内联展开下拉菜单：苹果等级 + 跟进阶段
 */
Component({
  properties: {
    appleRank: {
      type: String,
      value: '全部'
    },
    stage: {
      type: String,
      value: '全部'
    }
  },

  data: {
    showAppleDropdown: false,
    showStageDropdown: false,
    appleFilter: '全部',
    appleFilterLabel: '全部',
    stageFilter: '全部',
    stageFilterLabel: '全部',
    appleOptions: [
      { value: '全部',   label: '全部' },
      { value: '红苹果', label: '🔴 红苹果' },
      { value: '青苹果', label: '🟢 青苹果' },
      { value: '烂苹果', label: '🟤 烂苹果' },
      { value: '待定',   label: '🟡 待定' }
    ],
    stageOptions: [
      { value: '全部',   label: '全部' },
      { value: '初步接触', label: '初步接触' },
      { value: '需求沟通', label: '需求沟通' },
      { value: '已成交',   label: '已成交' },
      { value: '已拒绝',   label: '已拒绝' }
    ]
  },

  observers: {
    'appleRank': function (val) {
      if (val && val !== this.data.appleFilter) {
        var label = this._findLabel(this.data.appleOptions, val);
        this.setData({ appleFilter: val, appleFilterLabel: label });
      }
    },
    'stage': function (val) {
      if (val && val !== this.data.stageFilter) {
        var label = this._findLabel(this.data.stageOptions, val);
        this.setData({ stageFilter: val, stageFilterLabel: label });
      }
    }
  },

  methods: {
    /** 根据 value 查找 label */
    _findLabel: function (options, value) {
      for (var i = 0; i < options.length; i++) {
        if (options[i].value === value) return options[i].label;
      }
      return value;
    },

    /** 切换苹果等级下拉 */
    toggleAppleDropdown: function () {
      this.setData({
        showAppleDropdown: !this.data.showAppleDropdown,
        showStageDropdown: false
      });
    },

    /** 切换跟进阶段下拉 */
    toggleStageDropdown: function () {
      this.setData({
        showStageDropdown: !this.data.showStageDropdown,
        showAppleDropdown: false
      });
    },

    /** 选择苹果等级 */
    onAppleSelect: function (e) {
      var value = e.currentTarget.dataset.value;
      var label = e.currentTarget.dataset.label;
      this.setData({
        appleFilter: value,
        appleFilterLabel: label,
        showAppleDropdown: false
      });
      this.triggerEvent('change', { type: 'appleRank', value: value });
    },

    /** 选择跟进阶段 */
    onStageSelect: function (e) {
      var value = e.currentTarget.dataset.value;
      var label = e.currentTarget.dataset.label;
      this.setData({
        stageFilter: value,
        stageFilterLabel: label,
        showStageDropdown: false
      });
      this.triggerEvent('change', { type: 'stage', value: value });
    },

    /** 关闭所有下拉（遮罩点击） */
    closeDropdowns: function () {
      this.setData({
        showAppleDropdown: false,
        showStageDropdown: false
      });
    }
  }
});

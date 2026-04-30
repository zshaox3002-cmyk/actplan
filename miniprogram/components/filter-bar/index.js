/**
 * filter-bar 组件 — 跟进阶段筛选
 */
var constants = require('../../utils/constants');

Component({
  properties: {
    stage: {
      type: String,
      value: '全部'
    }
  },

  data: {
    showStageDropdown: false,
    stageFilter: '全部',
    stageFilterLabel: '全部',
    stageOptions: constants.STAGE_OPTIONS.map(function (s) {
      return { value: s, label: s };
    })
  },

  observers: {
    'stage': function (val) {
      if (val && val !== this.data.stageFilter) {
        this.setData({ stageFilter: val, stageFilterLabel: val });
      }
    }
  },

  methods: {
    toggleStageDropdown: function () {
      this.setData({ showStageDropdown: !this.data.showStageDropdown });
    },

    onStageSelect: function (e) {
      var value = e.currentTarget.dataset.value;
      this.setData({ stageFilter: value, stageFilterLabel: value, showStageDropdown: false });
      this.triggerEvent('change', { type: 'stage', value: value });
    },

    closeDropdowns: function () {
      this.setData({ showStageDropdown: false });
    }
  }
});

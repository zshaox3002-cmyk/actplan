/**
 * empty-state — 空状态组件
 * Props: icon(可选图标emoji)、text(主文案)、subText(副文案)、actionLabel(可选按钮文案)
 * Events: action（点击操作按钮时触发）
 */

Component({
  properties: {
    icon: {
      type: String,
      value: ''
    },
    text: {
      type: String,
      value: '暂无数据'
    },
    subText: {
      type: String,
      value: ''
    },
    actionLabel: {
      type: String,
      value: ''
    }
  },

  methods: {
    onActionTap: function () {
      this.triggerEvent('action');
    }
  }
});

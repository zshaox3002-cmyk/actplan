/**
 * search-bar 组件
 * 搜索框，支持关键词输入和清除
 */
Component({
  properties: {
    value: {
      type: String,
      value: ''
    },
    placeholder: {
      type: String,
      value: '搜索客户姓名'
    }
  },

  methods: {
    /** 输入事件 */
    onInput: function (e) {
      this.triggerEvent('input', { value: e.detail.value });
    },

    /** 清除按钮 */
    onClear: function () {
      this.setData({ value: '' });
      this.triggerEvent('input', { value: '' });
      this.triggerEvent('clear');
    },

    /** 确认搜索 */
    onConfirm: function (e) {
      this.triggerEvent('search', { value: e.detail.value });
    }
  }
});

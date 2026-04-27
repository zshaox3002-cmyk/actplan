/**
 * tag-selector — 标签式单选组件
 * Props:
 *   options: Array   — 选项列表 ['面对面', '电话', '微信']
 *   value: String    — 当前选中值
 * Events:
 *   change — 选中变化，e.detail = { value }
 */

Component({
  properties: {
    options: {
      type: Array,
      value: []
    },
    value: {
      type: String,
      value: ''
    }
  },

  methods: {
    onTagTap: function (e) {
      var val = e.currentTarget.dataset.val;
      this.triggerEvent('change', { value: val });
    }
  }
});

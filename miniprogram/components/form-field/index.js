/**
 * form-field — 表单字段组件
 * Props:
 *   label: String       — 字段标签
 *   type: String        — 'text'|'textarea'|'number'|'date'|'picker'
 *   value: String       — 当前值
 *   placeholder: String — 占位提示
 *   required: Boolean   — 是否必填（显示*号）
 *   disabled: Boolean   — 是否禁用
 *   options: Array      — picker 模式的选项列表
 * Events:
 *   change — 值变化，e.detail = { value }
 */

Component({
  properties: {
    label: {
      type: String,
      value: ''
    },
    type: {
      type: String,
      value: 'text'
    },
    value: {
      type: String,
      value: ''
    },
    placeholder: {
      type: String,
      value: ''
    },
    required: {
      type: Boolean,
      value: false
    },
    disabled: {
      type: Boolean,
      value: false
    },
    options: {
      type: Array,
      value: []
    }
  },

  methods: {
    onInput: function (e) {
      if (this.data.disabled) return;
      this.triggerEvent('change', { value: e.detail.value });
    },

    onPickerChange: function (e) {
      if (this.data.disabled) return;
      var idx = e.detail.value;
      var selected = this.data.options[idx];
      this.triggerEvent('change', { value: selected });
    }
  }
});

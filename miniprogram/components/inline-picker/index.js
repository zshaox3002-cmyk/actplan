Component({
  options: {
    addGlobalClass: true
  },

  properties: {
    label: {
      type: String,
      value: ''
    },
    options: {
      type: Array,
      value: []
    },
    value: {
      type: Number,
      value: -1
    },
    disabled: {
      type: Boolean,
      value: false
    },
    showDot: {
      type: Boolean,
      value: false
    },
    /** 是否隐藏顶部分割线（紧跟 section-title 后的第一个字段使用） */
    noTopBorder: {
      type: Boolean,
      value: false
    }
  },

  data: {
    expanded: false
  },

  methods: {
    onToggle: function () {
      if (this.properties.disabled) return;
      this.setData({ expanded: !this.data.expanded });
    },

    onSelect: function (e) {
      var index = parseInt(e.currentTarget.dataset.index);
      this.setData({ expanded: false });
      this.triggerEvent('change', { value: index });
    }
  }
});

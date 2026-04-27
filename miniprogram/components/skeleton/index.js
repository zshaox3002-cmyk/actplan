/**
 * skeleton — 骨架屏组件
 * Props: rows（骨架行数，默认 5）
 * 用于列表加载态展示
 */

Component({
  properties: {
    rows: {
      type: Number,
      value: 5
    }
  },

  data: {
    items: []
  },

  observers: {
    'rows': function (val) {
      var arr = [];
      for (var i = 0; i < val; i++) {
        arr.push(i);
      }
      this.setData({ items: arr });
    }
  },

  lifetimes: {
    attached: function () {
      var arr = [];
      for (var i = 0; i < this.data.rows; i++) {
        arr.push(i);
      }
      this.setData({ items: arr });
    }
  }
});

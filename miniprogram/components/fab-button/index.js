/**
 * fab-button — 右下角浮动操作按钮组件
 * Events:
 *   tap — 点击按钮
 */

Component({
  methods: {
    onTap: function () {
      this.triggerEvent('tap');
    }
  }
});

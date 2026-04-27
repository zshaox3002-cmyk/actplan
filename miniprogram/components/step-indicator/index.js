/**
 * step-indicator — 步骤指示器组件
 * Props:
 *   steps: Array<String> — 步骤名称列表
 *   current: Number      — 当前步骤索引（0-based）
 */

Component({
  properties: {
    steps: {
      type: Array,
      value: []
    },
    current: {
      type: Number,
      value: 0
    }
  }
});

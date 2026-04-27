/**
 * metric-card — 指标卡片组件
 * 白色卡片，左上角彩色小圆点，36px 大数字 + 12px 小标签
 * Props: value(Number), label(String), dotColor(String, 可选)
 */

Component({
  properties: {
    value: {
      type: Number,
      value: 0
    },
    label: {
      type: String,
      value: ''
    },
    dotColor: {
      type: String,
      value: ''
    }
  }
});

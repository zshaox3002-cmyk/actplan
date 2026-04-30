/**
 * chart.js — 通用图表绘制函数
 * 基于 Canvas 2D API，供各页面/组件复用
 */

/** 间隙角度（2rpx 近似） */
var GAP_ANGLE = 0.03;

/**
 * 绘制圆环图（Donut Chart）
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D 上下文
 * @param {Array<{value: number, color: string}>} segments - 各段数据
 * @param {number} cx - 圆心 X（逻辑像素）
 * @param {number} cy - 圆心 Y（逻辑像素）
 * @param {number} outerR - 外半径
 * @param {number} innerR - 内半径
 */
function drawDonutChart(ctx, segments, cx, cy, outerR, innerR) {
  if (!segments || segments.length === 0) return;

  // 计算总值
  var total = 0;
  var validCount = 0;
  for (var i = 0; i < segments.length; i++) {
    var v = segments[i].value || 0;
    total += v;
    if (v > 0) validCount++;
  }
  if (total === 0) return;

  // 先画背景圆环（间隙色 = 页面底色）
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.arc(cx, cy, innerR, Math.PI * 2, 0, true);
  ctx.closePath();
  ctx.fillStyle = '#F4F7FB';
  ctx.fill();

  // 绘制圆环扇区（带间隙）
  var startAngle = -Math.PI / 2; // 从顶部开始
  var gapAngle = validCount > 1 ? GAP_ANGLE : 0;

  for (var j = 0; j < segments.length; j++) {
    var seg = segments[j];
    var val = seg.value || 0;
    if (val === 0) continue;

    var sweepAngle = (val / total) * 2 * Math.PI - gapAngle;
    if (sweepAngle < 0) sweepAngle = 0;

    // 绘制扇形环（外弧 - 内弧）
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, startAngle + gapAngle / 2, startAngle + gapAngle / 2 + sweepAngle);
    ctx.arc(cx, cy, innerR, startAngle + gapAngle / 2 + sweepAngle, startAngle + gapAngle / 2, true);
    ctx.closePath();
    ctx.fillStyle = seg.color || '#9CA3AF';
    ctx.fill();

    startAngle += sweepAngle + gapAngle;
  }

  // 中心白色遮罩（确保圆环效果 + 覆盖背景色）
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
}

module.exports = {
  drawDonutChart: drawDonutChart
};

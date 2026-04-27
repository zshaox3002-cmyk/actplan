/**
 * chart-pie — Canvas 2D 自绘圆环图（Donut Chart）
 * Props: data [{name, value, color?}]
 * 左侧画圆环（各段间2rpx间隙），中心显示总计，右侧图例展示名称+数量+百分比
 * dpr 适配，attached 和 data 变化时重绘
 */

/** 预定义色板（与 variables.wxss 苹果等级色对应） */
var COLOR_PALETTE = ['#E74C3C', '#27AE60', '#6B7280', '#F39C12', '#1A6FD4', '#4F46E5'];

/** 间隙角度（2rpx 近似） */
var GAP_ANGLE = 0.03;

Component({
  properties: {
    data: {
      type: Array,
      value: []
    }
  },

  observers: {
    'data': function () {
      if (this._canvasReady) this._draw();
    }
  },

  lifetimes: {
    attached: function () {
      this._canvasReady = false;
      var that = this;
      setTimeout(function () {
        that._canvasReady = true;
        that._draw();
      }, 150);
    }
  },

  methods: {
    _draw: function () {
      var that = this;
      wx.createSelectorQuery().in(this)
        .select('#pieCanvas')
        .fields({ node: true, size: true })
        .exec(function (res) {
          if (!res || !res[0] || !res[0].node) return;

          var canvas = res[0].node;
          var ctx = canvas.getContext('2d');
          var dpr = wx.getSystemInfoSync().pixelRatio;
          var w = res[0].width;
          var h = res[0].height;

          canvas.width = w * dpr;
          canvas.height = h * dpr;
          ctx.scale(dpr, dpr);

          that._render(ctx, w, h);
        });
    },

    _render: function (ctx, w, h) {
      var data = this.data.data;
      if (!data || data.length === 0) {
        ctx.fillStyle = '#9CA3AF';
        ctx.font = '13px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('暂无数据', w / 2, h / 2);
        return;
      }

      // 计算总值
      var total = 0;
      var validCount = 0;
      for (var i = 0; i < data.length; i++) {
        var v = data[i].value || 0;
        total += v;
        if (v > 0) validCount++;
      }
      if (total === 0) return;

      // 圆环参数
      var outerR = Math.min(w * 0.28, h * 0.40);
      var ringWidth = outerR * 0.32;  // 环宽 = 外半径 × 0.32
      var innerR = outerR - ringWidth;
      var cx = w * 0.28;
      var cy = h * 0.50;

      // 先画背景圆环（间隙色 = 页面底色）
      ctx.beginPath();
      ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
      ctx.arc(cx, cy, innerR, Math.PI * 2, 0, true);
      ctx.closePath();
      ctx.fillStyle = '#F5F6FA';
      ctx.fill();

      // 绘制圆环扇区（带间隙）
      var startAngle = -Math.PI / 2;
      var gapAngle = validCount > 1 ? GAP_ANGLE : 0;

      for (var j = 0; j < data.length; j++) {
        var item = data[j];
        var val = item.value || 0;
        if (val === 0) continue;
        var sweepAngle = (val / total) * 2 * Math.PI - gapAngle;
        if (sweepAngle < 0) sweepAngle = 0;
        var color = item.color || COLOR_PALETTE[j % COLOR_PALETTE.length];

        // 绘制扇形环（外弧 - 内弧）
        ctx.beginPath();
        ctx.arc(cx, cy, outerR, startAngle + gapAngle / 2, startAngle + gapAngle / 2 + sweepAngle);
        ctx.arc(cx, cy, innerR, startAngle + gapAngle / 2 + sweepAngle, startAngle + gapAngle / 2, true);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();

        startAngle += sweepAngle + gapAngle;
      }

      // 中心总计文字
      ctx.fillStyle = '#1A1A2E';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(total), cx, cy - 7);

      ctx.fillStyle = '#9CA3AF';
      ctx.font = '11px sans-serif';
      ctx.fillText('总计', cx, cy + 13);

      // 右侧图例：● 名称  数量  百分比
      var legendX = w * 0.56;
      var legendStartY = h * 0.15;
      var legendGap = 44;

      for (var k = 0; k < data.length; k++) {
        var legendItem = data[k];
        var ly = legendStartY + k * legendGap;
        var lColor = legendItem.color || COLOR_PALETTE[k % COLOR_PALETTE.length];
        var pct = total > 0 ? ((legendItem.value || 0) / total * 100).toFixed(1) : '0.0';

        // 色块圆点 12rpx ≈ 6px
        ctx.fillStyle = lColor;
        ctx.beginPath();
        ctx.arc(legendX, ly, 6, 0, Math.PI * 2);
        ctx.fill();

        // 名称
        ctx.fillStyle = '#6B7280';
        ctx.font = '13px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(legendItem.name || '', legendX + 16, ly);

        // 数量（粗体）
        var nameWidth = ctx.measureText(legendItem.name || '').width;
        ctx.fillStyle = '#1A1A2E';
        ctx.font = '600 13px sans-serif';
        ctx.fillText(String(legendItem.value || 0), legendX + 16 + nameWidth + 10, ly);

        // 百分比
        var numText = String(legendItem.value || 0);
        var numWidth = ctx.measureText(numText).width;
        ctx.fillStyle = '#9CA3AF';
        ctx.font = '12px sans-serif';
        ctx.fillText(pct + '%', legendX + 16 + nameWidth + 10 + numWidth + 8, ly);
      }
    }
  }
});

/**
 * chart-bar — Canvas 2D 自绘柱状图
 *
 * 模式 1（分类柱状图）：
 *   Props: data [{name, value}], series 不传或 series.length === 1
 *   用于异议分布：横向类目 + 柱顶数字
 *
 * 模式 2（双系列并列柱）：
 *   Props: data [{label, planCount, visitCount}], series [{key, name, color}]
 *   用于拜访趋势：7天 × 两色柱（计划量灰 / 拜访量蓝）
 *
 * dpr 适配
 */

var COLOR_PALETTE = ['#1A6FD4', '#D1D5DB', '#E74C3C', '#27AE60', '#F39C12', '#4F46E5'];

Component({
  properties: {
    data: {
      type: Array,
      value: []
    },
    series: {
      type: Array,
      value: []
    }
  },

  observers: {
    'data': function () {
      if (this._canvasReady) this._draw();
    },
    'series': function () {
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
        .select('#barCanvas')
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

          var series = that.data.series;
          if (series && series.length >= 2) {
            that._renderDualSeries(ctx, w, h);
          } else {
            that._renderSingleSeries(ctx, w, h);
          }
        });
    },

    /**
     * 模式 1：单系列分类柱状图（异议分布）
     */
    _renderSingleSeries: function (ctx, w, h) {
      var data = this.data.data;
      if (!data || data.length === 0) {
        ctx.fillStyle = '#9CA3AF';
        ctx.font = '13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('暂无数据', w / 2, h / 2);
        return;
      }

      var maxVal = 0;
      for (var i = 0; i < data.length; i++) {
        if (data[i].value > maxVal) maxVal = data[i].value;
      }
      if (maxVal === 0) maxVal = 1;

      var paddingLeft = 12;
      var paddingRight = 12;
      var paddingTop = 24;
      var paddingBottom = 28;
      var chartW = w - paddingLeft - paddingRight;
      var chartH = h - paddingTop - paddingBottom;

      var barCount = data.length;
      var gap = Math.max(8, chartW / barCount * 0.3);
      var barW = (chartW - gap * (barCount + 1)) / barCount;
      barW = Math.max(barW, 12);

      // 网格线
      ctx.strokeStyle = '#E5E7EB';
      ctx.lineWidth = 0.5;
      for (var g = 0; g <= 4; g++) {
        var gy = paddingTop + chartH * (1 - g / 4);
        ctx.beginPath();
        ctx.moveTo(paddingLeft, gy);
        ctx.lineTo(w - paddingRight, gy);
        ctx.stroke();
      }

      for (var j = 0; j < data.length; j++) {
        var item = data[j];
        var x = paddingLeft + gap + j * (barW + gap);
        var barH = (item.value / maxVal) * chartH;
        var y = paddingTop + chartH - barH;
        var color = item.color || COLOR_PALETTE[j % COLOR_PALETTE.length];

        // 柱体
        ctx.fillStyle = color;
        ctx.beginPath();
        var r = Math.min(4, barW / 2);
        this._roundRect(ctx, x, y, barW, barH, r);
        ctx.fill();

        // 柱顶数字
        ctx.fillStyle = '#1A1A2E';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(item.value, x + barW / 2, y - 4);

        // X轴标签
        ctx.fillStyle = '#6B7280';
        ctx.font = '11px sans-serif';
        ctx.textBaseline = 'top';
        ctx.fillText(item.name, x + barW / 2, paddingTop + chartH + 6);
      }
    },

    /**
     * 模式 2：双系列并列柱（拜访趋势）
     */
    _renderDualSeries: function (ctx, w, h) {
      var data = this.data.data;
      var series = this.data.series;

      if (!data || data.length === 0) {
        ctx.fillStyle = '#9CA3AF';
        ctx.font = '13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('暂无数据', w / 2, h / 2);
        return;
      }

      // 计算最大值
      var maxVal = 0;
      for (var i = 0; i < data.length; i++) {
        for (var s = 0; s < series.length; s++) {
          var key = series[s].key;
          var val = data[i][key] || 0;
          if (val > maxVal) maxVal = val;
        }
      }
      if (maxVal === 0) maxVal = 1;

      var paddingLeft = 12;
      var paddingRight = 12;
      var paddingTop = 24;
      var paddingBottom = 28;
      var chartW = w - paddingLeft - paddingRight;
      var chartH = h - paddingTop - paddingBottom;

      var groupCount = data.length;
      var groupGap = Math.max(12, chartW / groupCount * 0.25);
      var groupW = (chartW - groupGap * (groupCount + 1)) / groupCount;
      var innerGap = 2;
      var barW = (groupW - innerGap * (series.length - 1)) / series.length;
      barW = Math.max(barW, 8);

      // 网格线
      ctx.strokeStyle = '#E5E7EB';
      ctx.lineWidth = 0.5;
      for (var g = 0; g <= 4; g++) {
        var gy = paddingTop + chartH * (1 - g / 4);
        ctx.beginPath();
        ctx.moveTo(paddingLeft, gy);
        ctx.lineTo(w - paddingRight, gy);
        ctx.stroke();
      }

      for (var d = 0; d < data.length; d++) {
        var item = data[d];
        var groupX = paddingLeft + groupGap + d * (groupW + groupGap);

        for (var si = 0; si < series.length; si++) {
          var sKey = series[si].key;
          var sColor = series[si].color;
          var val2 = item[sKey] || 0;
          var bx = groupX + si * (barW + innerGap);
          var barH2 = (val2 / maxVal) * chartH;
          var by = paddingTop + chartH - barH2;

          // 柱体
          ctx.fillStyle = sColor;
          ctx.beginPath();
          var r2 = Math.min(3, barW / 2);
          this._roundRect(ctx, bx, by, barW, barH2, r2);
          ctx.fill();

          // 柱顶数字
          if (val2 > 0) {
            ctx.fillStyle = '#1A1A2E';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(val2, bx + barW / 2, by - 3);
          }
        }

        // X轴标签
        ctx.fillStyle = '#6B7280';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(item.label || '', groupX + groupW / 2, paddingTop + chartH + 6);
      }

      // 图例（右上角）
      var legendX = w - paddingRight;
      var legendY = 4;
      for (var li = series.length - 1; li >= 0; li--) {
        var lName = series[li].name;
        var lColor = series[li].color;

        ctx.font = '10px sans-serif';
        var tw = ctx.measureText(lName).width;
        legendX -= tw;
        ctx.fillStyle = '#6B7280';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(lName, legendX, legendY + 6);

        legendX -= 14;
        ctx.fillStyle = lColor;
        ctx.beginPath();
        ctx.arc(legendX + 4, legendY + 6, 4, 0, Math.PI * 2);
        ctx.fill();

        legendX -= 8;
      }
    },

    /**
     * 绘制圆角矩形
     */
    _roundRect: function (ctx, x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      if (h < 1) {
        ctx.rect(x, y, w, Math.max(h, 1));
        return;
      }
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.arcTo(x + w, y, x + w, y + r, r);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x, y + r);
      ctx.arcTo(x, y, x + r, y, r);
      ctx.closePath();
    }
  }
});

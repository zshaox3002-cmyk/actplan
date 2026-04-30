/**
 * insight.js — 文字洞察生成器
 * 纯函数，基于规则模板生成 2-3 句复盘洞察
 */

/**
 * 生成文字洞察
 * @param {Object} current - 本期指标 { visitCount, newCustomers, stageAdvances, dealCount }
 * @param {Object} previous - 上期指标（同结构）
 * @param {Array} methodComparison - 拜访方式对比 [{ way, count, advanceRate }]
 * @returns {string} 2-3 句洞察文字
 */
function generateInsight(current, previous, methodComparison) {
  var sentences = [];

  if (current.visitCount === 0) {
    return '本期暂无拜访记录。';
  }

  // 规则 1：拜访方式推进率对比
  if (methodComparison.length >= 2) {
    var sorted = methodComparison.slice().sort(function (a, b) {
      return b.advanceRate - a.advanceRate;
    });
    var best = sorted[0];
    var worst = sorted[sorted.length - 1];
    if (best.advanceRate > 0 && worst.advanceRate >= 0 && best.way !== worst.way) {
      if (worst.advanceRate === 0) {
        sentences.push(best.way + '拜访推进率' + best.advanceRate + '%，' + worst.way + '暂无推进。');
      } else {
        var ratio = (best.advanceRate / worst.advanceRate).toFixed(1);
        sentences.push(best.way + '拜访推进率是' + worst.way + '的' + ratio + '倍。');
      }
    }
  }

  // 规则 2：拜访量环比变化
  if (previous.visitCount > 0) {
    var change = current.visitCount - previous.visitCount;
    var pct = Math.round(Math.abs(change) / previous.visitCount * 100);
    if (change > 0 && pct >= 20) {
      sentences.push('拜访量较上期增长' + pct + '%，保持势头。');
    } else if (change < 0 && pct >= 30) {
      sentences.push('拜访量较上期下降' + pct + '%，建议关注。');
    }
  }

  // 规则 3：成交亮点
  if (current.dealCount > 0) {
    sentences.push(current.dealCount + '位客户本期成交。');
  }

  // 规则 4：阶段推进
  if (current.stageAdvances > 0 && sentences.length < 3) {
    sentences.push(current.stageAdvances + '次阶段推进，客户在向前走。');
  }

  // 规则 5：新客户
  if (current.newCustomers > 0 && sentences.length < 3) {
    sentences.push('新增' + current.newCustomers + '位客户。');
  }

  if (sentences.length === 0) {
    sentences.push('本期拜访' + current.visitCount + '次。');
  }

  return sentences.slice(0, 3).join('');
}

module.exports = {
  generateInsight: generateInsight
};

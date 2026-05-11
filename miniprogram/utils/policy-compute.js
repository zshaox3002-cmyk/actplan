/**
 * policy-compute.js — 保单自动推导函数
 * 纯函数，不依赖 storage，所有计算基于传入参数
 */

var dateUtil = require('./date');

/**
 * 将 YYYY-MM-DD 加 N 年后的日期字符串
 * @param {string} dateStr
 * @param {number} years
 * @returns {string}
 */
function addYears(dateStr, years) {
  var d = new Date(dateStr);
  d.setFullYear(d.getFullYear() + years);
  return dateUtil.formatDate(d, 'YYYY-MM-DD');
}

/**
 * 根据生效日和保障期计算到期日
 * to_age 类型因无出生年份无法推导，返回 null
 * @param {string} effectiveDate - 'YYYY-MM-DD'
 * @param {{ type: string, value: number|null }} coverageTerm
 * @returns {string|null}
 */
function computeExpiryDate(effectiveDate, coverageTerm) {
  if (!effectiveDate || !coverageTerm) return null;
  switch (coverageTerm.type) {
    case 'lifetime': return null;
    case 'years': return addYears(effectiveDate, coverageTerm.value);
    case 'to_age': return null;
    default: return null;
  }
}

/**
 * 计算下次缴费日（下一个周年缴费日期）
 * @param {string} effectiveDate - 'YYYY-MM-DD'
 * @param {{ type: string, value: number|null }} paymentTerm
 * @returns {string|null}
 */
function computeNextPaymentDate(effectiveDate, paymentTerm) {
  if (!effectiveDate || !paymentTerm) return null;
  if (paymentTerm.type === 'single') return null;

  var today = dateUtil.today();
  var effDate = new Date(effectiveDate);
  var effYear = effDate.getFullYear();
  var todayDate = new Date(today);
  var todayYear = todayDate.getFullYear();

  // 已缴年数 = 今年 - 生效年（已过了几个周年日）
  var yearsPaid = todayYear - effYear;

  // 若今年周年日已过，则 yearsPaid 即为已缴年数，下次为 yearsPaid+1 年
  // 若今年周年日未到，则下次为 yearsPaid 年
  var anniversaryThisYear = addYears(effectiveDate, yearsPaid);
  if (anniversaryThisYear < today) {
    yearsPaid += 1;
  }

  // same_as_coverage（年缴续保，每年缴一次）：下一个周年日
  if (paymentTerm.type === 'same_as_coverage') {
    return addYears(effectiveDate, yearsPaid);
  }

  // years：检查是否已缴完
  if (paymentTerm.type === 'years') {
    if (yearsPaid >= paymentTerm.value) return null;
    return addYears(effectiveDate, yearsPaid);
  }

  return null;
}

/**
 * 计算缴费结束日
 * @param {string} effectiveDate - 'YYYY-MM-DD'
 * @param {{ type: string, value: number|null }} paymentTerm
 * @returns {string|null}
 */
function computePaymentEndDate(effectiveDate, paymentTerm) {
  if (!effectiveDate || !paymentTerm) return null;
  if (paymentTerm.type === 'years' && paymentTerm.value) {
    return addYears(effectiveDate, paymentTerm.value);
  }
  return null;
}

/**
 * 计算保单年度（第几保单年，从 1 起）
 * @param {string} effectiveDate - 'YYYY-MM-DD'
 * @returns {number}
 */
function computePolicyYear(effectiveDate) {
  if (!effectiveDate) return 1;
  var days = dateUtil.daysBetween(dateUtil.today(), effectiveDate);
  return Math.max(1, Math.floor(days / 365) + 1);
}

/**
 * 计算保单完整度
 * 必填 4 字段 + 可选 2 字段，分母 6
 * @param {Object} policy
 * @returns {number} 0~1
 */
function computeCompleteness(policy) {
  var score = 0;
  if (policy.category || policy.product_type) score++;
  if (policy.product_name) score++;
  if (policy.premium) score++;
  if (policy.effective_date) score++;
  var ct = policy.coverage_term;
  if (ct && ct.value !== null && ct.type !== 'lifetime') score++;
  var pt = policy.payment_term;
  if (pt && pt.value !== null && pt.type !== 'single' && pt.type !== 'same_as_coverage') score++;
  return score / 6;
}

/**
 * 计算保单卡片状态（优先级从高到低）
 * @param {Object} policy - 含 effective_date/coverage_term/payment_term/status
 * @param {string} today - 'YYYY-MM-DD'
 * @returns {{ status: string, label: string, daysText: string, eventDate: string, colorClass: string }}
 */
function computePolicyCardStatus(policy, today) {
  // 已断保：直接返回，不再走缴费/到期逻辑
  if (policy.status === 'expired') {
    return {
      status: 'expired',
      label: '已断保',
      daysText: '已断保',
      eventDate: '',
      colorClass: 'expired'
    };
  }

  var templates = require('./policy-templates');
  var cat = policy.category || templates.inferCategoryFromProductType(policy.product_type || '');
  var tmpl = templates.getTemplate(cat);
  var ct = policy.coverage_term || tmpl.coverage_term;
  var pt = policy.payment_term || tmpl.payment_term;

  var nextPaymentDate = computeNextPaymentDate(policy.effective_date, pt);
  var expiryDate = computeExpiryDate(policy.effective_date, ct);

  // 1. 已逾期（缴费日已过）
  if (nextPaymentDate && nextPaymentDate < today) {
    var overdueDays = dateUtil.daysBetween(today, nextPaymentDate);
    return {
      status: 'overdue',
      label: '已逾期',
      daysText: '已逾期 ' + overdueDays + ' 天',
      eventDate: nextPaymentDate,
      colorClass: 'danger'
    };
  }

  // 2. 临近缴费（≤ 30 天）
  if (nextPaymentDate) {
    var daysToPayment = dateUtil.daysBetween(nextPaymentDate, today);
    if (daysToPayment <= 30) {
      return {
        status: 'near_payment',
        label: '缴费日',
        daysText: daysToPayment === 0 ? '今日缴费日' : '距缴费日 ' + daysToPayment + ' 天',
        eventDate: nextPaymentDate,
        colorClass: 'warning'
      };
    }
  }

  // 3. 临近到期（≤ 60 天）
  if (expiryDate) {
    var daysToExpiry = dateUtil.daysBetween(expiryDate, today);
    if (daysToExpiry >= 0 && daysToExpiry <= 60) {
      return {
        status: 'near_expiry',
        label: '临近到期',
        daysText: '距到期 ' + daysToExpiry + ' 天',
        eventDate: expiryDate,
        colorClass: 'caution'
      };
    }
  }

  // 4. 周年日（距今年或明年周年日 ≤ 7 天）
  if (policy.effective_date) {
    var policyYear = computePolicyYear(policy.effective_date);
    var anniversary = addYears(policy.effective_date, policyYear - 1);
    // 若今年周年日已过，用下一年
    if (anniversary < today) {
      anniversary = addYears(policy.effective_date, policyYear);
    }
    var daysToAnniversary = dateUtil.daysBetween(anniversary, today);
    if (daysToAnniversary >= 0 && daysToAnniversary <= 7) {
      return {
        status: 'anniversary',
        label: '保单周年',
        daysText: daysToAnniversary === 0 ? '今日周年' : '周年日还 ' + daysToAnniversary + ' 天',
        eventDate: anniversary,
        colorClass: 'info'
      };
    }
  }

  // 5. 正常，展示下次缴费日（若有）
  var normalEventDate = nextPaymentDate || '';
  var normalDaysText = '';
  if (nextPaymentDate) {
    var daysLeft = dateUtil.daysBetween(nextPaymentDate, today);
    normalDaysText = '距缴费 ' + daysLeft + ' 天';
  } else if (expiryDate) {
    var daysLeftExp = dateUtil.daysBetween(expiryDate, today);
    normalDaysText = '距到期 ' + daysLeftExp + ' 天';
    normalEventDate = expiryDate;
  } else {
    normalDaysText = '保障中';
  }

  return {
    status: 'normal',
    label: '',
    daysText: normalDaysText,
    eventDate: normalEventDate,
    colorClass: 'neutral'
  };
}

/**
 * 计算本年待缴总保费
 * @param {Array<Object>} policies
 * @param {string} today - 'YYYY-MM-DD'
 * @returns {number}
 */
function computeYearlyPendingPremium(policies, today) {
  var year = today.substring(0, 4);
  var yearStart = year + '-01-01';
  var yearEnd = year + '-12-31';
  var total = 0;
  var templates = require('./policy-templates');

  for (var i = 0; i < policies.length; i++) {
    var p = policies[i];
    if (p.status !== 'active') continue;
    var cat = p.category || templates.inferCategoryFromProductType(p.product_type || '');
    var tmpl = templates.getTemplate(cat);
    var pt = p.payment_term || tmpl.payment_term;
    var nextPayment = computeNextPaymentDate(p.effective_date, pt);
    if (nextPayment && nextPayment >= yearStart && nextPayment <= yearEnd) {
      total += (p.premium || 0);
    }
  }
  return total;
}

module.exports = {
  computeExpiryDate: computeExpiryDate,
  computeNextPaymentDate: computeNextPaymentDate,
  computePaymentEndDate: computePaymentEndDate,
  computePolicyYear: computePolicyYear,
  computeCompleteness: computeCompleteness,
  computePolicyCardStatus: computePolicyCardStatus,
  computeYearlyPendingPremium: computeYearlyPendingPremium
};

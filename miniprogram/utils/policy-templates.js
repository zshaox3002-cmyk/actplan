/**
 * policy-templates.js — 险种模板配置与格式化
 * 纯函数，无副作用，不依赖 storage
 */

var CATEGORY_OPTIONS = [
  'medical',
  'critical_illness',
  'term_life',
  'whole_life',
  'annuity',
  'accident',
  'education'
];

var CATEGORY_LABELS = ['医疗', '重疾', '定期寿险', '终身寿险', '年金', '意外', '教育金'];

var TEMPLATES = {
  medical: {
    coverage_term: { type: 'years', value: 1 },
    payment_term: { type: 'same_as_coverage', value: null },
    show_payment_term: false
  },
  critical_illness: {
    coverage_term: { type: 'lifetime', value: null },
    payment_term: { type: 'years', value: 20 },
    show_payment_term: true
  },
  term_life: {
    coverage_term: { type: 'to_age', value: 60 },
    payment_term: { type: 'years', value: 20 },
    show_payment_term: true
  },
  whole_life: {
    coverage_term: { type: 'lifetime', value: null },
    payment_term: { type: 'years', value: 10 },
    show_payment_term: true
  },
  annuity: {
    coverage_term: { type: 'lifetime', value: null },
    payment_term: { type: 'single', value: null },
    show_payment_term: true
  },
  accident: {
    coverage_term: { type: 'years', value: 1 },
    payment_term: { type: 'same_as_coverage', value: null },
    show_payment_term: false
  },
  education: {
    coverage_term: { type: 'to_age', value: 18 },
    payment_term: { type: 'years', value: 10 },
    show_payment_term: true
  }
};

var PRODUCT_TYPE_TO_CATEGORY = {
  '重疾': 'critical_illness',
  '医疗': 'medical',
  '教育金': 'education',
  '养老': 'annuity',
  '意外': 'accident',
  '寿险': 'whole_life'
};

var CATEGORY_TO_COVERAGE_KEY = {
  medical: '医疗',
  critical_illness: '重疾',
  term_life: '寿险',
  whole_life: '寿险',
  annuity: '养老',
  accident: '意外',
  education: '教育金'
};

/**
 * 获取指定 category 的险种模板
 * @param {string} category
 * @returns {{ coverage_term: Object, payment_term: Object, show_payment_term: boolean }}
 */
function getTemplate(category) {
  return TEMPLATES[category] || TEMPLATES.critical_illness;
}

/**
 * 根据旧 product_type 字符串推导 category，无法匹配时返回 'critical_illness'
 * @param {string} productType
 * @returns {string}
 */
function inferCategoryFromProductType(productType) {
  return PRODUCT_TYPE_TO_CATEGORY[productType] || 'critical_illness';
}

/**
 * 将 coverage_term 格式化为展示文本
 * @param {{ type: string, value: number|null }} coverageTerm
 * @returns {string}
 */
function formatCoverageTerm(coverageTerm) {
  if (!coverageTerm) return '';
  switch (coverageTerm.type) {
    case 'lifetime': return '保终身';
    case 'years': return '保 ' + coverageTerm.value + ' 年';
    case 'to_age': return '保至 ' + coverageTerm.value + ' 岁';
    default: return '';
  }
}

/**
 * 将 payment_term 格式化为展示文本
 * @param {{ type: string, value: number|null }} paymentTerm
 * @returns {string}
 */
function formatPaymentTerm(paymentTerm) {
  if (!paymentTerm) return '';
  switch (paymentTerm.type) {
    case 'years': return '缴 ' + paymentTerm.value + ' 年';
    case 'single': return '一次性缴清';
    case 'same_as_coverage': return '同保障期';
    default: return '';
  }
}

/**
 * 生成保单摘要副标题，如 "保终身 · 缴 20 年"
 * @param {{ type: string, value: number|null }} coverageTerm
 * @param {{ type: string, value: number|null }} paymentTerm
 * @param {boolean} showPaymentTerm
 * @returns {string}
 */
function formatPolicySummary(coverageTerm, paymentTerm, showPaymentTerm) {
  var ct = formatCoverageTerm(coverageTerm);
  if (!showPaymentTerm) return ct;
  var pt = formatPaymentTerm(paymentTerm);
  return ct && pt ? ct + ' · ' + pt : ct || pt;
}

/**
 * 根据 category 获取 coverage_status 中对应的中文键
 * @param {string} category
 * @returns {string}
 */
function getCoverageKey(category) {
  return CATEGORY_TO_COVERAGE_KEY[category] || '重疾';
}

module.exports = {
  CATEGORY_OPTIONS: CATEGORY_OPTIONS,
  CATEGORY_LABELS: CATEGORY_LABELS,
  getTemplate: getTemplate,
  inferCategoryFromProductType: inferCategoryFromProductType,
  formatCoverageTerm: formatCoverageTerm,
  formatPaymentTerm: formatPaymentTerm,
  formatPolicySummary: formatPolicySummary,
  getCoverageKey: getCoverageKey
};

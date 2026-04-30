/**
 * constants.js — 全局常量：枚举值、配置项
 * 所有业务枚举集中管理，页面和组件引用此文件，禁止写死字符串
 */

/** 跟进阶段 */
var STAGE = {
  MEET: '初步认识',
  COMMUNICATING: '需求沟通',
  PRESENTING: '方案讲解',
  CLOSING: '待促成',
  DEAL: '已成交',
  LOST: '已流失'
};

/** 跟进阶段列表（用于筛选下拉） */
var STAGE_OPTIONS = ['全部', '初步认识', '需求沟通', '方案讲解', '待促成', '已成交', '已流失'];

/** 跟进优先级标签 */
var PRIORITY_LABELS = {
  P0: '今日必跟',
  P1: '本周重点',
  P2: '保持节奏',
  P3: '暂缓跟进'
};

/** 三维度选项 */
var DIMENSION_OPTIONS = ['是', '否', '不确定'];

/** 拜访方式 */
var VISIT_WAY = {
  FACE: '面对面',
  PHONE: '电话',
  WECHAT: '微信'
};

/** 拜访方式列表 */
var VISIT_WAY_OPTIONS = ['面对面', '电话', '微信'];

/** 异议分类 */
var OBJECTION_CATEGORY = {
  PRICE: '价格',
  NECESSITY: '必要性',
  TIMING: '时机',
  COMPARISON: '产品对比',
  TRUST: '信任',
  OTHER: '其他'
};

/** 异议分类列表 */
var OBJECTION_CATEGORY_OPTIONS = ['价格', '必要性', '时机', '产品对比', '信任', '其他'];

/** 计划状态 */
var PLAN_STATUS = {
  PENDING: '待执行',
  COMPLETED: '已完成'
};

/** 成交状态 */
var DEAL_STATUS = {
  DEAL: '签单成交',
  NO_DEAL: '暂未成交'
};

/** 性别选项 */
var GENDER_OPTIONS = ['男', '女'];

/** Dashboard 周期 */
var DASHBOARD_PERIOD = {
  WEEK: 'week',
  MONTH: 'month'
};

/** 数据库文件名 */
var DB_FILE_NAME = 'aia_agent_db.sqlite';

/** 数据库版本号（用于迁移检查） */
var DB_VERSION = 2;

/** 指标卡圆点颜色 */
var METRIC_DOT_COLORS = {
  TOTAL: '#0EA5A4',
  NEW: '#27AE60',
  VISIT: '#F39C12',
  APPOINTMENT: '#8B5CF6'
};

/** 阶段 → CSS class 映射 */
var STAGE_CLASS_MAP = {
  '初步认识': 'meet',
  '需求沟通': 'comm',
  '方案讲解': 'present',
  '待促成':   'closing',
  '已成交':   'deal',
  '已流失':   'lost'
};

module.exports = {
  STAGE: STAGE,
  STAGE_OPTIONS: STAGE_OPTIONS,
  STAGE_CLASS_MAP: STAGE_CLASS_MAP,
  PRIORITY_LABELS: PRIORITY_LABELS,
  DIMENSION_OPTIONS: DIMENSION_OPTIONS,
  VISIT_WAY: VISIT_WAY,
  VISIT_WAY_OPTIONS: VISIT_WAY_OPTIONS,
  OBJECTION_CATEGORY: OBJECTION_CATEGORY,
  OBJECTION_CATEGORY_OPTIONS: OBJECTION_CATEGORY_OPTIONS,
  PLAN_STATUS: PLAN_STATUS,
  DEAL_STATUS: DEAL_STATUS,
  GENDER_OPTIONS: GENDER_OPTIONS,
  DASHBOARD_PERIOD: DASHBOARD_PERIOD,
  DB_FILE_NAME: DB_FILE_NAME,
  DB_VERSION: DB_VERSION,
  METRIC_DOT_COLORS: METRIC_DOT_COLORS
};

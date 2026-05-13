/**
 * customer-schema.js — 客户 CSV/xlsx 列定义和字段映射
 *
 * 导入/导出字段：姓名、性别、关系来源、年收入、年龄段、职业、居住情况、婚姻状况、亲密度、跟进阶段
 */

var COLUMNS = [
  { key: 'name',       label: '姓名',     required: true,  type: 'string' },
  { key: 'gender',     label: '性别',     required: false, type: 'enum',
    enumValues: ['男', '女', '未知'] },
  { key: 'relation',   label: '关系来源', required: false, type: 'enum',
    enumValues: ['同事', '朋友', '亲戚', '同学', '邻居', '客户介绍', '陌生拜访', '其他'] },
  { key: 'income',     label: '年收入',   required: false, type: 'enum',
    enumValues: ['10万以下', '10–30万', '30–50万', '50–100万', '100–300万', '300万以上', '未知'] },
  { key: 'age_range',  label: '年龄段',   required: false, type: 'enum',
    enumValues: ['25岁以下', '25–34岁', '35–44岁', '45–54岁', '55–64岁', '65岁以上'] },
  { key: 'occupation', label: '职业',     required: false, type: 'enum',
    enumValues: ['企业职员', '企业管理层', '个体经营', '自由职业', '医疗/教育/公务员', '金融从业者', '工程技术', '全职家庭', '学生', '其他'] },
  { key: 'residence',  label: '居住情况', required: false, type: 'enum',
    enumValues: ['自住房（无贷）', '自住房（有贷）', '租房', '与父母同住', '其他'] },
  { key: 'marital',    label: '婚姻状况', required: false, type: 'enum',
    enumValues: ['未婚', '已婚–无子', '已婚–有子', '离异', '丧偶'] },
  { key: 'intimacy',   label: '亲密度',   required: false, type: 'enum',
    enumValues: ['陌生', '普通朋友', '熟人', '好友', '亲密'] },
  { key: 'stage',      label: '跟进阶段', required: false, type: 'enum',
    enumValues: ['初步认识', '需求沟通', '方案讲解', '待促成', '已成交', '已流失'] }
];

var HEADERS = COLUMNS.map(function (c) { return c.label; });

var LABEL_TO_KEY = {};
COLUMNS.forEach(function (c) { LABEL_TO_KEY[c.label] = c.key; });

var KEY_TO_COL = {};
COLUMNS.forEach(function (c) { KEY_TO_COL[c.key] = c; });

// 兼容旧引用
var EXPORT_HEADERS = HEADERS;
var IMPORT_HEADERS = HEADERS;
var IMPORT_COLUMNS = COLUMNS;

module.exports = {
  COLUMNS: COLUMNS,
  HEADERS: HEADERS,
  EXPORT_HEADERS: EXPORT_HEADERS,
  IMPORT_HEADERS: IMPORT_HEADERS,
  IMPORT_COLUMNS: IMPORT_COLUMNS,
  LABEL_TO_KEY: LABEL_TO_KEY,
  KEY_TO_COL: KEY_TO_COL
};

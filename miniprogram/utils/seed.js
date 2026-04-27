/**
 * seed.js — 测试假数据生成器
 * 在微信开发者工具 Console 中输入：require('../../utils/seed').run()
 * 即可一键灌入测试数据
 */

var storage = require('./storage');
var customerRepo = require('./repository/customer.repo');
var planRepo = require('./repository/plan.repo');
var recordRepo = require('./repository/record.repo');
var objectionRepo = require('./repository/objection.repo');
var logRepo = require('./repository/log.repo');
var dateUtil = require('./date');
/* DISABLED: apple-auto-grade - 改为用户手动打标，不再自动计算
var appleRank = require('./apple-rank');
*/

// ===================== 客户数据 =====================

/**
 * desire/health/budget 1~3 → has_need/has_budget/is_decider 映射
 * 3 = 是, 2 = 不确定, 1 = 否
 */
function _dim(val) {
  return val >= 3 ? '是' : val <= 1 ? '否' : '不确定';
}

var CUSTOMERS = [
  { name: '张伟',   phone: '13800138001', wechat: 'zhangwei_wx',   age: 35, gender: '男', source: '转介绍', note: '老客户推荐，对重疾险感兴趣',     desire: 3, health: 2, budget: 3 },
  { name: '李娜',   phone: '13900139002', wechat: 'lina_wx',       age: 28, gender: '女', source: '线上获客', note: '刚结婚，考虑夫妻互保',         desire: 2, health: 3, budget: 2 },
  { name: '王强',   phone: '13700137003', wechat: 'wangqiang_wx',   age: 42, gender: '男', source: '缘故市场', note: '老同学，两个孩子，教育金需求', desire: 1, health: 1, budget: 3 },
  { name: '赵敏',   phone: '13600136004', wechat: 'zhaomin_wx',     age: 31, gender: '女', source: '社区活动', note: '新手妈妈，宝宝保险刚需',       desire: 3, health: 3, budget: 1 },
  { name: '陈刚',   phone: '13500135005', wechat: 'chengang_wx',    age: 50, gender: '男', source: '转介绍', note: '企业主，关注资产传承',           desire: 2, health: 1, budget: 3 },
  { name: '刘洋',   phone: '13400134006', wechat: 'liuyang_wx',     age: 38, gender: '男', source: '线上获客', note: 'IT从业者，关注养老金',          desire: 2, health: 2, budget: 2 },
  { name: '孙丽',   phone: '13300133007', wechat: 'sunli_wx',       age: 45, gender: '女', source: '缘故市场', note: '高管，已有重疾想加保',           desire: 3, health: 1, budget: 3 },
  { name: '周涛',   phone: '13200132008', wechat: 'zhoutao_wx',     age: 33, gender: '男', source: '社区活动', note: '自由职业者，医疗险需求',         desire: 1, health: 2, budget: 1 },
  { name: '吴芳',   phone: '13100131009', wechat: 'wufang_wx',     age: 29, gender: '女', source: '线上获客', note: '职场新人，预算有限',             desire: 1, health: 3, budget: 1 },
  { name: '郑明',   phone: '13000130010', wechat: 'zhengming_wx',   age: 55, gender: '男', source: '转介绍', note: '退休教师，关注年金',             desire: 2, health: 1, budget: 2 },
  { name: '黄蕾',   phone: '15800158011', wechat: 'huanglei_wx',   age: 36, gender: '女', source: '缘故市场', note: '二胎妈妈，保障缺口大',           desire: 3, health: 2, budget: 2 },
  { name: '林峰',   phone: '15900159012', wechat: 'linfeng_wx',     age: 40, gender: '男', source: '社区活动', note: '个体户，关注意外+医疗',          desire: 1, health: 3, budget: 1 },
  { name: '何静',   phone: '15700157013', wechat: 'hejing_wx',     age: 32, gender: '女', source: '转介绍', note: '律师，重疾+定寿需求',            desire: 3, health: 3, budget: 3 },
  { name: '罗刚',   phone: '15600156014', wechat: 'luogang_wx',     age: 48, gender: '男', source: '缘故市场', note: '医生，已有基础保障想优化',       desire: 2, health: 3, budget: 3 },
  { name: '马丽',   phone: '15500155015', wechat: 'mali_wx',       age: 27, gender: '女', source: '线上获客', note: '留学归来，父母催买保险',         desire: 2, health: 3, budget: 2 },
  { name: '谢勇',   phone: '15400154016', wechat: 'xieyong_wx',    age: 52, gender: '男', source: '社区活动', note: '小企业主，员工团险+个人保障',   desire: 1, health: 1, budget: 2 },
  { name: '韩雪',   phone: '15300153017', wechat: 'hanxue_wx',     age: 34, gender: '女', source: '转介绍', note: '全职妈妈，配偶保险意识弱',       desire: 3, health: 2, budget: 1 },
  { name: '唐磊',   phone: '15200152018', wechat: 'tanglei_wx',     age: 39, gender: '男', source: '缘故市场', note: '金融从业者，懂产品但犹豫',       desire: 2, health: 2, budget: 3 },
  { name: '冯颖',   phone: '15100151019', wechat: 'fengying_wx',   age: 30, gender: '女', source: '线上获客', note: '备孕中，关注母婴险',             desire: 3, health: 2, budget: 2 },
  { name: '曹辉',   phone: '15000150020', wechat: 'caohui_wx',     age: 44, gender: '男', source: '社区活动', note: '出租车司机，意外险刚需',         desire: 1, health: 1, budget: 1 }
];

// ===================== 异议数据 =====================

var OBJECTIONS = [
  { customer_idx: 0, category: '价格',   content: '保费太贵了，每年要交好几万，压力太大',                          solution: '您说得对，保费确实是一笔支出。但我们可以先从基础保障做起，年缴几千元也能覆盖重疾风险。而且保险费是跟年龄挂钩的，越早买越便宜。' },
  { customer_idx: 1, category: '时机',   content: '我刚结婚，现在经济紧张，过几年再说吧',                          solution: '理解您的情况。其实刚结婚正是建立家庭保障的最佳时机，夫妻互保还有豁免优势。而且越年轻保费越低，等几年保费可能上涨30%以上。' },
  { customer_idx: 3, category: '必要性', content: '我有社保，感觉不需要商业保险了',                                solution: '社保是基础保障，但有很多限制：药品目录限制、起付线和封顶线、异地就医报销比例低等。商业险可以补充社保的缺口，特别是重疾险是确诊即赔，不限用途。' },
  { customer_idx: 4, category: '产品对比', content: '我朋友推荐了某某公司的产品，说性价比更高',                       solution: '不同公司的产品定位和保障范围差异很大，单纯比价格不一定公平。我们可以逐项对比保障责任，看看哪个更适合您的实际情况。' },
  { customer_idx: 5, category: '信任',   content: '我之前被其他代理人坑过，不敢轻易相信了',                          solution: '很抱歉您有过不好的体验。我们可以先把方案和条款逐条过一遍，所有承诺都以合同条款为准。您也可以对比多家产品，我帮您客观分析。' },
  { customer_idx: 7, category: '价格',   content: '现在收入不稳定，万一断交怎么办',                                solution: '我们有一年宽限期，60天内补交不影响保障。另外可以选择较长的缴费期（20年/30年），年缴压力更小。如果真的遇到困难，还有减额交清的选项。' },
  { customer_idx: 9, category: '时机',   content: '我都这把年纪了，买保险还来得及吗',                              solution: '年龄确实会影响保费，但保障永远不嫌晚。我们有专门针对50+人群的产品，健康告知也更宽松。现在买至少比不买强，而且越等保费越高。' },
  { customer_idx: 12, category: '必要性', content: '我身体很健康，暂时不需要保险',                                  solution: '这正是买保险的最佳时机！保险不是给生病的人准备的，是给健康的人准备的。一旦身体出现异常，可能就买不了了。健康时的选择权是最多的。' }
];

// ===================== 拜访记录模板 =====================

var RECORD_TEMPLATES = [
  { deal: 1, stage: '需求沟通', method: '面谈', summary: '客户对重疾险表达了明确兴趣，约定下周出方案',         next_step: '准备重疾险方案，下次带计划书' },
  { deal: 0, stage: '需求沟通', method: '电话', summary: '电话沟通基本需求，客户表示需要考虑',               next_step: '3天后微信跟进，分享理赔案例' },
  { deal: 1, stage: '已成交',   method: '面谈', summary: '详细讲解方案，客户当场签约',                       next_step: '协助完成健康告知和投保流程' },
  { deal: 0, stage: '初步接触', method: '微信', summary: '微信简单问候，客户回复积极但未深入',               next_step: '约线下见面详细沟通' },
  { deal: 1, stage: '需求沟通', method: '面谈', summary: '带方案上门，客户对教育金产品很感兴趣',             next_step: '调整方案预算，下次确认' },
  { deal: 0, stage: '初步接触', method: '电话', summary: '客户出差中，简单寒暄后约回程再联系',               next_step: '下周二再致电' },
  { deal: 1, stage: '已成交',   method: '面谈', summary: '夫妻共同面谈，当场签下夫妻互保方案',               next_step: '跟进体检安排' },
  { deal: 0, stage: '已拒绝',   method: '面谈', summary: '客户觉得保费超预算，委婉拒绝',                     next_step: '降低保额重新出方案，保持联系' },
  { deal: 0, stage: '需求沟通', method: '微信', summary: '分享养老金文章，客户咨询了几个问题',               next_step: '整理年金产品对比表发给他' },
  { deal: 1, stage: '需求沟通', method: '面谈', summary: '客户对医疗险组合方案满意，要求回去和家人商量',     next_step: '3天后电话回访' }
];

// ===================== 主执行函数 =====================

function run() {
  if (!storage.isReady()) {
    console.error('[Seed] Storage 未初始化，请等待 App onLaunch 完成');
    return;
  }

  console.log('[Seed] 🌱 开始灌入测试数据...');

  // ---------- 1. 创建客户 ----------
  var customerIds = [];
  for (var i = 0; i < CUSTOMERS.length; i++) {
    var c = CUSTOMERS[i];
    // 苹果等级：本地计算（不再依赖 apple-rank 模块）
    var _need = _dim(c.desire);
    var _budget = _dim(c.budget);
    var _decider = _dim(c.health);
    var grade = 'pending';
    if (_need !== '不确定' && _budget !== '不确定' && _decider !== '不确定') {
      var yesCount = 0;
      if (_need === '是') yesCount++;
      if (_budget === '是') yesCount++;
      if (_decider === '是') yesCount++;
      if (yesCount === 3) grade = 'red';
      else if (yesCount === 2) grade = 'green';
      else grade = 'rotten';
    }
    var now = dateUtil.formatDate(new Date());

    var id = customerRepo.create({
      name: c.name,
      phone: c.phone,
      wechat: c.wechat,
      gender: c.gender,
      relation: '其他',
      income: ['10万以下', '10–30万', '30–50万', '50–100万', '100–300万', '300万以上', '未知'][Math.floor(Math.random() * 7)],
      age_range: ['25岁以下', '25–34岁', '35–44岁', '45–54岁', '55–64岁', '65岁以上'][Math.min(5, Math.max(0, Math.floor((c.age - 25) / 10)))],
      occupation: '其他',
      residence: '其他',
      marital: '已婚–有子',
      intimacy: '普通朋友',
      apple_grade: grade,
      stage: i < 5 ? '已成交' : (i < 12 ? '需求沟通' : '初步接触'),
      stage_updated_at: now,
      family: '有未成年子女',
      has_need: _need,
      has_ability: _budget,
      is_decider: _decider,
      visit_count: i < 5 ? (2 + Math.floor(Math.random() * 4)) : (i < 12 ? (1 + Math.floor(Math.random() * 2)) : 0),
      last_visit: i < 5 ? dateUtil.formatDate(new Date(Date.now() - Math.random() * 7 * 86400000)) : (i < 12 ? dateUtil.formatDate(new Date(Date.now() - Math.random() * 14 * 86400000)) : '')
    });
    customerIds.push(id);
  }
  console.log('[Seed] ✅ 创建 ' + customerIds.length + ' 个客户');

  // ---------- 2. 创建拜访计划（本周+下周） ----------
  var planCount = 0;
  var today = new Date();
  var dayOfWeek = today.getDay() || 7; // 1=Mon ... 7=Sun

  // 本周计划
  for (var d = 0; d < 7; d++) {
    var offset = d - dayOfWeek + 1; // 周一=0
    var planDate = new Date(today.getTime() + offset * 86400000);
    var dateStr = dateUtil.formatDate(planDate);

    // 每天安排 1-2 个计划
    var planPerDay = d < 2 ? 2 : 1;
    for (var p = 0; p < planPerDay; p++) {
      var cidx = (d * 2 + p) % customerIds.length;
      var status = offset < 0 ? 'completed' : 'pending';
      planRepo.create({
        customer_id: customerIds[cidx],
        plan_date: dateStr,
        status: status
      });
      planCount++;
    }
  }

  // 下周 3 个计划
  for (var nw = 1; nw <= 3; nw++) {
    var nextDate = new Date(today.getTime() + (7 - dayOfWeek + nw) * 86400000);
    planRepo.create({
      customer_id: customerIds[nw + 5],
      plan_date: dateUtil.formatDate(nextDate),
      status: 'pending'
    });
    planCount++;
  }
  console.log('[Seed] ✅ 创建 ' + planCount + ' 个拜访计划');

  // ---------- 3. 创建拜访记录 ----------
  var recordCount = 0;
  for (var r = 0; r < RECORD_TEMPLATES.length; r++) {
    var tpl = RECORD_TEMPLATES[r];
    var cidx2 = r % customerIds.length;
    var daysAgo = Math.floor(Math.random() * 14) + 1;
    var visitDate = new Date(today.getTime() - daysAgo * 86400000);

    recordRepo.create({
      customer_id: customerIds[cidx2],
      visit_date: dateUtil.formatDate(visitDate),
      method: tpl.method,
      stage: tpl.stage,
      deal: tpl.deal,
      summary: tpl.summary,
      next_step: tpl.next_step,
      note: ''
    });
    recordCount++;
  }
  console.log('[Seed] ✅ 创建 ' + recordCount + ' 个拜访记录');

  // ---------- 4. 创建异议 ----------
  var objectionIds = [];
  for (var o = 0; o < OBJECTIONS.length; o++) {
    var obj = OBJECTIONS[o];
    var created = objectionRepo.create({
      customer_id: customerIds[obj.customer_idx],
      category: obj.category,
      content: obj.content,
      solution: obj.solution,
      count: 1 + Math.floor(Math.random() * 3) // 1-3次
    });
    objectionIds.push(created.id);

    // 追加 1-2 条备注
    var noteCount = Math.floor(Math.random() * 2) + 1;
    for (var n = 0; n < noteCount; n++) {
      var noteDaysAgo = Math.floor(Math.random() * 10) + 1;
      var noteDate = new Date(today.getTime() - noteDaysAgo * 86400000);
      objectionRepo.appendNote(
        oid,
        customerIds[(obj.customer_idx + n + 1) % customerIds.length],
        '第' + (n + 1) + '次遇到同类异议，客户态度' + (n === 0 ? '犹豫' : '松动')
      );
    }
  }
  console.log('[Seed] ✅ 创建 ' + objectionIds.length + ' 个异议（含追加备注）');

  // ---------- 5. 创建操作日志 ----------
  var logCount = 0;
  var logActions = [
    { action: 'create_customer', detail: '创建客户 张伟' },
    { action: 'update_customer', detail: '修改客户 李娜 苹果等级' },
    { action: 'create_plan',     detail: '添加拜访计划 王强 2026-04-21' },
    { action: 'complete_plan',   detail: '完成拜访计划 赵敏' },
    { action: 'create_record',   detail: '新建拜访记录 陈刚 面谈' },
    { action: 'create_objection', detail: '新建异议 价格-保费太贵' },
    { action: 'append_objection', detail: '追加异议备注 价格-保费太贵' }
  ];

  for (var l = 0; l < logActions.length; l++) {
    var logDaysAgo = Math.floor(Math.random() * 7);
    var logDate = new Date(today.getTime() - logDaysAgo * 86400000);
    logRepo.add({ action: logActions[l].action, detail: logActions[l].detail });
    logCount++;
  }
  console.log('[Seed] ✅ 创建 ' + logCount + ' 条操作日志');

  // ---------- 6. 设置部分客户的 last_visit ----------
  // 确保前5个客户有 last_visit（模拟已拜访）
  for (var u = 0; u < 5 && u < customerIds.length; u++) {
    customerRepo.update(customerIds[u], {
      last_visit: dateUtil.formatDate(new Date(today.getTime() - (u + 1) * 86400000)),
      visit_count: 2 + u,
      stage: u < 2 ? '已成交' : '需求沟通',
      stage_updated_at: dateUtil.formatDate(new Date(today.getTime() - (u + 1) * 86400000))
    });
  }

  console.log('[Seed] 🎉 测试数据灌入完成！');
  console.log('[Seed] 📊 数据统计：');
  console.log('  客户：' + customerIds.length + ' 条');
  console.log('  计划：' + planCount + ' 条');
  console.log('  记录：' + recordCount + ' 条');
  console.log('  异议：' + objectionIds.length + ' 条');
  console.log('  日志：' + logCount + ' 条');
  console.log('[Seed] 💡 请切换到各 Tab 页查看效果');

  return {
    customers: customerIds.length,
    plans: planCount,
    records: recordCount,
    objections: objectionIds.length,
    logs: logCount
  };
}

/**
 * 清除所有业务数据（保留 db_meta）
 */
function clear() {
  storage.setTable('customer', []);
  storage.setTable('plan', []);
  storage.setTable('visit_record', []);
  storage.setTable('objection', []);
  storage.setTable('objection_note', []);
  storage.setTable('operation_log', []);
  console.log('[Seed] 🗑️ 已清除所有业务数据');
}

module.exports = {
  run: run,
  clear: clear
};

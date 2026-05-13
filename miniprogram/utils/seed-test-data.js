/**
 * seed-test-data.js — 节奏页测试数据注入脚本
 *
 * 使用方式：在微信开发者工具 Console 中执行以下代码
 * 执行后重启小程序（点击编译或刷新）使数据生效
 *
 * 清除测试数据：执行 cleanTestData() 函数
 */

(function seedTestData() {
  var meta = wx.getStorageSync('db_meta');
  var customers = wx.getStorageSync('db_customer') || [];
  var records = wx.getStorageSync('db_visit_record') || [];
  var plans = wx.getStorageSync('db_plan') || [];
  var notes = wx.getStorageSync('db_objection_note') || [];

  // 防止重复注入
  var exists = customers.some(function(c) { return c.name && c.name.indexOf('测试-') === 0; });
  if (exists) {
    console.warn('[seed] 测试数据已存在，跳过注入。如需重新注入请先执行 cleanTestData()');
    return;
  }

  var cId = meta.nextId.customer;
  var rId = meta.nextId.visit_record;
  var pId = meta.nextId.plan;
  var nId = meta.nextId.objection_note;

  function ts(d) { return d + 'T00:00:00.000Z'; }
  var cov = { '重疾': 'unknown', '医疗': 'unknown', '教育金': 'unknown', '养老': 'unknown', '意外': 'unknown', '寿险': 'unknown' };

  function mkCustomer(id, name, stage, stageDate, lastVisit) {
    return {
      id: id, name: name, stage: stage,
      stage_updated_at: ts(stageDate),
      created_at: ts(stageDate),
      last_visit: lastVisit,
      has_need: '不确定', has_ability: '不确定', is_decider: '不确定',
      intimacy: '普通朋友', is_hnw: false, referral_count: 0,
      phone: '', relation: '陌生拜访',
      birthday: null, policy_expire_date: null,
      coverage_status: cov
    };
  }

  // ── 卡点待处理 ──────────────────────────────────────────────

  // A: 阶段停留过久（需求沟通 23天，阈值21天）
  var cA = cId++;
  customers.push(mkCustomer(cA, '测试-卡点A', '需求沟通', '2026-04-20', '2026-04-20'));

  // B: 最近沟通受阻（方案讲解，8天前更新阶段，3天前受阻）
  var cB = cId++;
  customers.push(mkCustomer(cB, '测试-卡点B', '方案讲解', '2026-05-05', '2026-05-10'));
  records.push({
    id: rId++, customer_id: cB,
    visit_date: '2026-05-10', comm_result: '受阻', stage: '方案讲解',
    content: '客户表示暂时不考虑', created_at: ts('2026-05-10')
  });

  // C: 存在未化解异议（待促成，5天前）
  var cC = cId++;
  customers.push(mkCustomer(cC, '测试-卡点C', '待促成', '2026-05-08', '2026-05-08'));
  notes.push({
    id: nId++, customer_id: cC,
    result: '待处理', content: '客户对保费金额有异议',
    created_at: ts('2026-05-08')
  });

  // ── 断档风险 ────────────────────────────────────────────────

  // D: 方案讲解，10天无计划（阈值7天）
  var cD = cId++;
  customers.push(mkCustomer(cD, '测试-断档D', '方案讲解', '2026-05-03', '2026-05-03'));

  // E: 待促成，6天无计划（阈值5天）
  var cE = cId++;
  customers.push(mkCustomer(cE, '测试-断档E', '待促成', '2026-05-07', '2026-05-07'));

  // ── 该推进了 ────────────────────────────────────────────────

  // F: 最近7天内顺利沟通（需求沟通）
  var cF = cId++;
  customers.push(mkCustomer(cF, '测试-推进F', '需求沟通', '2026-05-01', '2026-05-11'));
  records.push({
    id: rId++, customer_id: cF,
    visit_date: '2026-05-11', comm_result: '顺利', stage: '需求沟通',
    content: '客户对方案感兴趣', created_at: ts('2026-05-11')
  });

  // ── 排除验证 ────────────────────────────────────────────────

  // G: 已成交，不应出现在任何分类
  var cG = cId++;
  customers.push(mkCustomer(cG, '测试-排除G', '已成交', '2026-01-01', '2026-01-01'));

  // H: 方案讲解10天，但有未来计划，不进断档风险
  var cH = cId++;
  customers.push(mkCustomer(cH, '测试-排除H', '方案讲解', '2026-05-03', '2026-05-03'));
  plans.push({
    id: pId++, customer_id: cH,
    plan_date: '2026-05-20', status: '待执行',
    content: '约定下次方案讲解', created_at: ts('2026-05-13')
  });

  // ── 写回 ────────────────────────────────────────────────────

  meta.nextId.customer = cId;
  meta.nextId.visit_record = rId;
  meta.nextId.plan = pId;
  meta.nextId.objection_note = nId;

  wx.setStorageSync('db_customer', customers);
  wx.setStorageSync('db_visit_record', records);
  wx.setStorageSync('db_plan', plans);
  wx.setStorageSync('db_objection_note', notes);
  wx.setStorageSync('db_meta', meta);

  console.log('[seed] 测试数据注入完成 ✓');
  console.log('[seed] 客户 IDs:', { A: cA, B: cB, C: cC, D: cD, E: cE, F: cF, G: cG, H: cH });
  console.log('[seed] 重启小程序后生效');
})();

// 清除测试数据（在 Console 中执行 cleanTestData()）
function cleanTestData() {
  var customers = wx.getStorageSync('db_customer') || [];
  var records = wx.getStorageSync('db_visit_record') || [];
  var plans = wx.getStorageSync('db_plan') || [];
  var notes = wx.getStorageSync('db_objection_note') || [];

  var testIds = customers
    .filter(function(c) { return c.name && c.name.indexOf('测试-') === 0; })
    .map(function(c) { return c.id; });

  if (testIds.length === 0) {
    console.log('[seed] 没有找到测试数据');
    return;
  }

  var idSet = {};
  testIds.forEach(function(id) { idSet[id] = true; });

  wx.setStorageSync('db_customer', customers.filter(function(c) { return !idSet[c.id]; }));
  wx.setStorageSync('db_visit_record', records.filter(function(r) { return !idSet[r.customer_id]; }));
  wx.setStorageSync('db_plan', plans.filter(function(p) { return !idSet[p.customer_id]; }));
  wx.setStorageSync('db_objection_note', notes.filter(function(n) { return !idSet[n.customer_id]; }));

  console.log('[seed] 已清除 ' + testIds.length + ' 个测试客户及其关联数据');
  console.log('[seed] 重启小程序后生效');
}

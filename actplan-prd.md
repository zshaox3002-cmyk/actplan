# actplan — 保险代理人活动管理小程序 PRD

**版本**：v1.0 | **更新日期**：2026-04-30

---

## 1. 产品概述

### 1.1 产品定位

actplan 是面向保险代理人的日常活动管理工具，帮助代理人系统化管理客户跟进、拜访计划、异议应对和销售复盘。

**技术形态**：微信小程序原生开发（WXML/WXSS/JS），零后端依赖，数据全部存储在微信本地 Storage（7 张表，总上限 10MB）。

### 1.2 目标用户

保险代理人，日常需要管理 10–100 名潜在客户，跟踪每位客户的跟进阶段、拜访记录和异议情况。

### 1.3 核心价值

| 痛点 | 解决方案 |
|------|---------|
| 客户多，不知道今天该跟谁 | P0–P3 动态优先级评分，每次打开即知今日重点 |
| 拜访后忘记记录，信息散落 | 单页平铺式拜访记录表单，事务性写入多表 |
| 异议应对没有积累 | 预置异议库 + 自建异议，自动统计出现次数和化解率 |
| 不知道哪些客户在升温/降温 | 节奏分析引擎，自动识别升温/降温/卡住三类客户 |
| 无法回顾销售活动效果 | 复盘模块，本期 vs 上期指标对比 + AI 洞察文字 |

---

## 2. 功能模块

### 2.1 概览（Dashboard）

**Tab Bar 入口：概览**

**今日拜访列表**：展示当日所有待执行计划，含计划时间、客户名、跟进阶段、执行按钮。逾期计划高亮提醒，点击执行按钮直接跳转新建记录页。

**周期进展指标**：支持本周 / 本月 / 季度 / 年度四个周期切换，展示四项指标：
- 新增客户（`created_at` 在周期内）
- 拜访次数（`visit_date` 在周期内）
- 预约计划（`plan_date` 在周期内）
- 本期成交（`stage='已成交'` 且 `stage_updated_at` 在周期内）

**客户阶段漏斗**：展示各阶段客户数量分布（初步认识 → 需求沟通 → 方案讲解 → 待促成 → 已成交 → 已流失）。

**待跟进 Top 3**：按优先级评分排序，展示最需要跟进的 3 位客户，含优先级标签、阶段、下次计划时间。点击跳转客户详情（计划 Tab）。

**逾期警示条**：有逾期计划时显示，点击滚动到待跟进区域。

---

### 2.2 客户（客户跟进池）

**Tab Bar 入口：客户**

**优先级排序**：所有客户按 P0→P1→P2→P3 排序，同级按评分降序。已成交/已流失客户不参与评分，排在末尾。

**多维筛选**：
- 优先级 Chip：全部 / P0 / P1 / P2 / 逾期（含各类别计数）
- 阶段 Chip：需求沟通 / 方案讲解 / 待促成 / 已成交

**关键词搜索**：实时过滤客户姓名、标签、备注。

**客户卡片**：展示优先级标签、客户名、阶段标签、下次跟进时间、上次沟通时间、最近摘要（截断 30 字）。下次跟进展示规则：无计划显示「未安排」，逾期显示「已逾期 N 天」，今天显示「今天」，未来显示「MM/DD HH:MM」。

**快捷操作**：卡片内置 +计划、+记录、删除三个快捷按钮，无需进入详情页。

**新建客户**：右下角 FAB 按钮，跳转客户详情页（新建模式）。

---

### 2.3 客户详情（5 Tab 工作台）

**入口**：从客户列表、概览、节奏等页面跳转

**顶部卡片**：客户名 + 优先级标签 + 阶段标签 + 自定义标签，展示最近沟通时间和下次跟进时间，提供「预约」和「随手记」两个快捷按钮。

**Tab 1 — 画像**：客户基本信息（性别、年龄范围、职业、收入、婚姻状况、家庭结构、居住类型、交情、关系来源）+ 跟进阶段 + 需求/能力/决策者三项判断 + 自定义标签。支持编辑态，字段变更自动写入 operation_log。

**Tab 2 — 沟通**：时间线展示所有拜访记录，含日期、拜访方式、摘要、阶段变化、下次计划。默认显示 5 条，支持展开全部。

**Tab 3 — 异议**：该客户关联的异议列表，含分类、内容、出现次数、最新化解结果、应对话术、备注数。支持新增和跳转详情。

**Tab 4 — 需求**：保障需求矩阵，6 个险种（重疾 / 医疗 / 教育金 / 养老 / 意外 / 寿险），每项状态为「关注中 / 有兴趣 / 待了解 / 暂不考虑」，支持编辑。

**Tab 5 — 计划**：待执行计划列表，含日期、时间、拜访方式，支持完成记录、修改、删除操作。

---

### 2.4 日历（日历看板）

**Tab Bar 入口：日历**

**双视图**：周视图（7 天）/ 月视图（42 天），支持切换和翻页导航。

**日期标记**：有计划或记录的日期显示标记点。

**事件列表**：选中日期后展示当日所有事件（计划 + 记录），按时间升序排列（全天事件排末尾）。事件状态：计划分为待执行 / 已完成 / 逾期，记录分为已完成 / 临时（adhoc）。

**跳转**：点击计划事件跳转客户详情，点击记录事件跳转记录详情。

---

### 2.5 节奏（节奏分析）

**Tab Bar 入口：节奏**

将所有客户分为三类，帮助代理人识别跨客户的跟进模式：

| 类型 | 判断规则 |
|------|---------|
| 升温中 | 最近 14 天拜访 ≥ 2 次，且近期频率 / 基线频率 ≥ 1.5 倍 |
| 降温中 | 距上次拜访 ≥ 14 天，或近期频率 / 基线频率 ≤ 0.5 倍 |
| 卡住了 | 在当前阶段停留超过阈值（初步认识/需求沟通 21 天，方案讲解 14 天，待促成 7 天） |

**顶部摘要条**：各类客户数 + 较上周变化。

**客户卡片**：客户名、阶段、最后拜访时间、信号文本（如「近 14 天未联系」）。点击跳转客户详情。

---

### 2.6 复盘

**Tab Bar 入口：复盘**

**周期选择**：本周 / 上周 / 本月

**AI 洞察文字**：基于规则模板生成 2–3 句总结，优先级顺序：拜访方式对比 → 拜访量环比 → 成交亮点 → 阶段推进 → 新客户。

**活动摘要**：拜访次数、新增客户、阶段推进、成交客户，每项含环比箭头。

**拜访方式对比**：面对面 / 电话 / 微信，展示次数和推进率（`smooth_result / total`）。

**阶段流转**：从 operation_log 统计 `field='stage'` 的变更，展示「从 X 阶段 → 到 Y 阶段 N 人」。

**异议回顾**：总数、已化解数、化解率，按分类展开（默认折叠，每类显示前 3 条）。

---

### 2.7 新建拜访记录（record-new）

**入口**：概览执行计划、客户卡片 +记录、客户详情随手记/完成记录

**两种模式**：
- `planned`：从计划执行，预填客户和计划信息
- `adhoc`：临时记录，手动选择客户

**表单字段**：沟通结果（进展顺利 / 一般 / 受阻 / 已成交）、沟通摘要、涉及异议（可标记化解状态）、跟进阶段、下次跟进预约（日期/方式/时间）。

**保存逻辑（事务性写入）**：
1. 插入 visit_record
2. 更新 customer.last_visit / visit_count
3. 若成交 → 更新 customer.stage='已成交'
4. 若有 plan_id → 更新 plan.status='已完成'

非事务后续：同步客户阶段、自动创建下次计划、写入新建异议。

---

### 2.8 异议管理

**入口**：从新建记录页进入

**异议池（objection/index）**：
- 分类 Tab 筛选（全部 / 价格 / 必要性 / 时机 / 产品对比 / 信任 / 其他）
- 排序切换（最近创建 ↔ 出现频次）
- 每条异议展示化解率（样本 ≥ 5 时显示）
- 左滑删除

**异议来源**：
- 预置异议：内置于代码，不存 storage，出现次数通过 `objection_links` 表统计
- 自建异议：存 `objection` 表，出现次数存 `count` 字段

**新建异议（objection-new）四步流程**：

| 步骤 | 内容 |
|------|------|
| Step 0 | 选择关联客户 |
| Step 1 | 输入异议内容 + 选择分类 |
| Step 2 | 展示同类已有记录，选择追加 or 新建（无同类时自动跳过） |
| Step 3 | 追加模式：填写备注 + 化解结果；新建模式：填写应对话术 + AI 提示词 |

**异议详情（objection-detail）**：分类、出现次数、化解率进度条（样本不足时提示）、异议内容、应对话术（预置异议显示四步结构）、实战记录列表。

---

## 3. 核心算法

### 3.1 客户优先级评分（P0–P3）

```
score = I（意向度）+ U（紧迫度）+ R（活跃度）
```

**意向度 I**（基于跟进阶段，满分 40）：

| 阶段 | 分值 |
|------|------|
| 待促成 | 40 |
| 方案讲解 | 30 |
| 需求沟通 | 20 |
| 初步认识 | 10 |
| 已成交 / 已流失 | 不参与评分 |

**紧迫度 U**（基于下次跟进计划日期，满分 35）：

| 距今 | 分值 |
|------|------|
| 逾期 3 天+ | 35 |
| 逾期 1–2 天 | 30 |
| 今天 | 25 |
| 明天 | 18 |
| 3 天内 | 12 |
| 7 天内 | 6 |
| 其他 / 无计划 | 0 |

**活跃度 R**（基于最后拜访日期，满分 25）：

| 距今 | 分值 |
|------|------|
| 3 天内 | 25 |
| 7 天内 | 18 |
| 14 天内 | 10 |
| 30 天内 | 5 |
| 30 天以上 / 从未拜访 | 0 |

**优先级映射**：P0 ≥ 80 / P1 ≥ 60 / P2 ≥ 35 / P3 < 35

---

## 4. 数据模型概览

### 4.1 存储表清单

| 表名 | Storage Key | 说明 |
|------|-------------|------|
| customer | db_customer | 客户信息，自增 ID |
| visit_record | db_visit_record | 拜访记录，自增 ID |
| plan | db_plan | 拜访计划，自增 ID |
| objection | db_objection | 用户自建异议，自增 ID |
| objection_note | db_objection_note | 异议追加备注，自增 ID |
| objection_links | db_objection_links | 预置异议引用计数，无自增 ID |
| operation_log | db_operation_log | 客户字段变更日志，自增 ID |

辅助存储：`db_meta` → `{ nextId: {...}, version: 1 }`

### 4.2 关键字段

**customer**：id, name, gender, age_range, occupation, income, marital, family, residence, intimacy, relation, stage（初步认识/需求沟通/方案讲解/待促成/已成交/已流失）, stage_updated_at, apple_grade（red/green/rotten/pending）, has_need, has_ability, is_decider, coverage_gap, coverage_needs（Object）, tags（Array）, last_visit, visit_count, created_at, updated_at

**plan**：id, customer_id, plan_date（YYYY-MM-DD）, plan_time（HH:mm|null）, visit_way, status（待执行/已完成）, created_at

**visit_record**：id, customer_id, plan_id, visit_date, visit_time, visit_way, duration, summary, stage, comm_result（smooth/normal/blocked/deal）, record_type（planned/adhoc）, is_deal（签单成交/暂未成交）, next_follow_date, has_objection, objection_ids（Array）, created_at

**objection_note**：id, objection_id, customer_id, note, result（已化解/仍在考虑/未化解）, created_at

### 4.3 跨表关联

```
customer ──1:N──→ plan, visit_record, objection, objection_note, operation_log
plan ──1:0..1──→ visit_record（plan.id = visit_record.plan_id）
objection ──1:N──→ objection_note
预置异议 ──1:N──→ objection_links（presetId 分组计数）
```

---

## 5. 页面导航地图

```
Tab Bar（5 项）
├── 概览（dashboard）
│   ├── → record-new（执行今日计划）
│   └── → customer-detail?tab=plan（待跟进客户）
├── 客户（customer）
│   ├── → customer-detail（客户详情）
│   └── → record-new?record_type=adhoc（快捷 +记录）
├── 日历（calendar）
│   ├── → customer-detail（点击计划事件）
│   └── → visit-record/detail（点击记录事件）
├── 节奏（rhythm）
│   └── → customer-detail（客户卡片）
└── 复盘（review）
    └── 独立页面，无跳转

customer-detail
├── → record-new（执行计划 / 随手记）
├── → objection-detail（异议详情）
├── → objection-new（新建异议）
└── → plan-select（新建/编辑计划）

record-new
├── → objection-new（新建异议）
└── → plan-select（选择关联计划）

objection（异议池，从 record-new 进入）
├── → objection-new（新建异议）
└── → objection-detail（异议详情）

objection-new
└── EventChannel → record-new（通知新建结果）
```

---

## 6. 技术约束

| 约束 | 说明 |
|------|------|
| 原生小程序 | WXML / WXSS / JS，禁止 React / Vue / TypeScript |
| 无 npm | 第三方库手动放 `lib/` 目录 |
| CSS 变量 | 所有颜色/间距/圆角必须引用 `styles/variables.wxss`，禁止写死数值 |
| Repository 层 | 页面禁止直接调用 storage，只能通过 `utils/repository/*` |
| 事务写入 | 多表写入必须使用 `storage.transaction()` |
| Storage 上限 | 单 key 1MB，总计 10MB；内置容量预警（800KB warn / 950KB critical） |
| 基础库版本 | 最低 2.10.0 |

---

*详细字段定义和跨表关系见 DATA_RELATIONSHIP.md。*

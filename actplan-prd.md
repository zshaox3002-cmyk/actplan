# actplan — 保险代理人活动管理小程序 PRD

**版本**：v1.1 | **更新日期**：2026-05-11

---

## 1. 产品概述

### 1.1 产品定位

actplan 是面向保险代理人的日常活动管理工具，帮助代理人系统化管理客户跟进、拜访计划、保单记录、异议应对和销售复盘。

**技术形态**：微信小程序原生开发（WXML/WXSS/JS），本地优先 + 云端备份（微信云开发），数据存储 9 张本地表（总上限 10MB）+ 云数据库异步备份。

### 1.2 目标用户

保险代理人，日常需要管理 10–100 名潜在客户，跟踪每位客户的跟进阶段、拜访记录、保单状况和异议情况。

### 1.3 核心价值

| 痛点 | 解决方案 |
|------|---------|
| 客户多，不知道今天该跟谁 | P0–P3 动态优先级评分，每次打开即知今日重点 |
| 拜访后忘记记录，信息散落 | 单页平铺式拜访记录表单，事务性写入多表 |
| 保单信息散落，无法快速了解客户保障全貌 | 客户详情保障矩阵 + 保单台账，支持自动保单（成交联动）+ 手动录入 |
| 异议应对没有积累 | 预置异议库 + 自建异议，自动统计出现次数和化解率 |
| 不知道哪些客户在升温/降温 | 节奏分析引擎，自动识别升温/降温/卡住三类客户 |
| 无法回顾销售活动效果 | 复盘模块，本期 vs 上期指标对比 + AI 洞察文字 |
| 想针对特定场景批量筛选客户 | 自定义视图（Segment），可配置多条件规则，支持系统预设 + 用户自建 |

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

---

### 2.2 客户（客户跟进池）

**Tab Bar 入口：客户**

**优先级排序**：所有客户按 P0→P1→P2→P3 排序，同级按评分降序。已成交/已流失客户不参与评分，排在末尾。

**视图 Chip 筛选**：替代原优先级/阶段 Chip 筛选，展示系统预设视图（沉睡金子 / 重要客户 / 高价值缺口）+ 用户自建视图（上限 10 个），每个 Chip 显示命中数。点击「+」进入视图编辑器。

**关键词搜索**：实时过滤客户姓名、标签。

**客户卡片**：展示优先级标签、客户名、阶段标签、下次跟进时间、上次沟通时间、最近摘要（截断 30 字）。下次跟进展示规则：无计划显示「未安排」，逾期显示「已逾期 N 天」，今天显示「今天」，未来显示「MM/DD HH:MM」。

**快捷操作**：卡片内置 +计划、+记录、删除三个快捷按钮。

**新建客户**：右下角 FAB 按钮，跳转客户详情页（新建模式）。

---

### 2.3 客户详情（5 Tab 工作台）

**入口**：从客户列表、概览、节奏等页面跳转

**顶部卡片**：客户名 + 优先级标签 + 阶段标签 + 自定义标签，展示最近沟通时间和下次跟进时间，提供「预约」和「随手记」两个快捷按钮。

**Tab 1 — 画像**：客户基本信息（性别、年龄范围、职业、收入、婚姻状况、家庭结构、居住类型、交情、关系来源）+ 跟进阶段 + 需求/能力/决策者三项判断 + 苹果等级（自动计算/手动覆盖）+ 自定义标签 + 扩展字段（是否高净值、转介绍次数、生日、保单到期日）。字段变更自动写入 operation_log。

**Tab 2 — 沟通**：时间线展示所有拜访记录，含日期、拜访方式、摘要、阶段变化、下次计划。默认显示 5 条，支持展开全部。

**Tab 3 — 异议**：该客户关联的异议列表，含分类、内容、出现次数、最新化解结果、应对话术、备注数。支持新增和跳转详情。

**Tab 4 — 需求**：保障状态矩阵，7 种险种（医疗 / 重疾 / 定期寿险 / 终身寿险 / 年金 / 意外 / 教育金），每项状态为 `configured`（系统自动）/ `gap`（代理人标记缺口）/ `none`（暂不考虑）/ `unknown`（未评估）。下方显示该客户所有保单台账，支持新增他渠道保单（跳转 policy-edit 页）和删除保单。

**Tab 5 — 计划**：待执行计划列表，含日期、时间、拜访方式，支持执行、修改、删除操作。

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

将所有客户分为三类：

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

**表单字段**：沟通结果（进展顺利 / 一般 / 受阻 / 已成交）、沟通摘要、涉及异议（可标记化解状态）、跟进阶段、成交信息（成交险种 + 保费 + 生效日期，仅 comm_result='deal' 时显示）、下次跟进预约（日期/方式/时间）。

**保存逻辑（事务性写入）**：
1. 插入 visit_record
2. 更新 customer.last_visit / visit_count
3. 若成交 → 更新 customer.stage='已成交'
4. 若有 plan_id → 更新 plan.status='已完成'
5. 若成交 → 为每个 deal_products 创建 policy(source='self') + 更新 customer.coverage_status

非事务后续：自动创建下次计划（若填写了 next_follow_date）、写入新建异议。

---

### 2.8 异议管理

**异议池（objection/index）**：
- 分类 Tab 筛选（全部 / 价格 / 必要性 / 时机 / 产品对比 / 信任 / 其他）
- 排序切换（最近创建 ↔ 出现频次）
- 每条异议展示化解率（样本 ≥ 5 时显示）
- 左滑删除（仅自建异议）

**异议来源**：
- 预置异议：内置于代码（`objection-preset.js`），不存 storage，出现次数通过 `objection_links` 表统计
- 自建异议：存 `objection` 表，出现次数存 `count` 字段

**新建异议（objection-new）四步流程**：

| 步骤 | 内容 |
|------|------|
| Step 0 | 选择关联客户 |
| Step 1 | 输入异议内容 + 选择分类 |
| Step 2 | 展示同类已有记录，选择追加 or 新建（无同类时自动跳过） |
| Step 3 | 追加模式：填写备注 + 化解结果；新建模式：填写应对话术 |

**异议选择（objection/select）**：从拜访记录页进入，批量选择要关联到本次记录的异议（自建 + 预置），选中预置异议时自动 incrementCount。

**异议详情（objection-detail）**：分类、出现次数、化解率进度条（样本不足时提示）、异议内容、应对话术（预置异议显示四步结构）、实战记录列表。

---

### 2.9 客户视图（segment-edit）

**入口**：客户列表「管理视图」入口

**系统预设视图（不可删除，仅可编辑规则和排序）**：

| 视图名 | 规则摘要 | 排序 |
|--------|---------|------|
| 沉睡金子 | (total_premium ≥ 50000 OR policy_count ≥ 2) AND days_since_last_visit ≥ 60 AND stage ≠ 已流失 | total_premium 降序 |
| 重要客户 | is_hnw=true OR intimacy ≥ 4 OR total_premium ≥ 50000 | total_premium 降序 |
| 高价值缺口 | coverage_status 任一险种=gap AND policy_count ≥ 2 | total_premium 降序 |

**自建视图上限**：10 个。

**规则编辑器**：支持字段选择（含派生字段 total_premium / policy_count / avg_premium）、操作符选择、值输入、嵌套 OR 子组。底部实时显示当前规则命中的客户数。

---

### 2.10 保单录入（policy-edit）

**入口**：客户详情需求 Tab 「+ 添加他渠道保单」

**险种**：医疗 / 重疾 / 定期寿险 / 终身寿险 / 年金 / 意外 / 教育金（共 7 种，英文 category 枚举）

**表单字段**：险种（必填，选择后自动填入保障期/缴费期默认值）、产品名（可选）、年缴保费（必填）、生效日期（必填）、保障期（coverage_term）、缴费期（payment_term，部分险种不显示）。

**保存逻辑（事务）**：
1. 写入 policy（source='external'）
2. 更新 customer.coverage_status[险种]='configured'
3. 写入 operation_log

---

## 3. 核心算法

### 3.1 客户优先级评分（P0–P3）

```
score = I（意向度，满分 40）+ U（紧迫度，满分 35）+ R（活跃度，满分 25）
```

**意向度 I**：

| 阶段 | 分值 |
|------|------|
| 待促成 | 40 |
| 方案讲解 | 30 |
| 需求沟通 | 20 |
| 初步认识 | 10 |
| 已成交 / 已流失 | 不参与评分 |

**紧迫度 U**：

| 距今 | 分值 |
|------|------|
| 逾期 3 天+ | 35 |
| 逾期 1–2 天 | 30 |
| 今天 | 25 |
| 明天 | 18 |
| 3 天内 | 12 |
| 7 天内 | 6 |
| 其他 / 无计划 | 0 |

**活跃度 R**：

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
| policy | db_policy | 保单（v1.1+），自增 ID |
| segment | db_segment | 客户视图（v1.1+），自增 ID |
| (meta) | db_meta | `{ nextId, version, derived_cache, dedup_v1_done, dedup_objection_v1_done }` |

云数据库（备份用）：`table_backup` 集合，文档结构 `{ _openid, table_name, data, updated_at }`

### 4.2 关键字段

**customer**：id, name, gender, age_range, occupation, income, marital, family, residence, intimacy, relation, stage（初步认识/需求沟通/方案讲解/待促成/已成交/已流失）, stage_updated_at, apple_grade（red/green/rotten/pending）, has_need, has_ability, is_decider, coverage_gap, coverage_status（Object，每个险种 configured/gap/none/unknown）, is_hnw, referral_count, birthday（MM-DD）, policy_expire_date（YYYY-MM-DD）, tags（Array）, last_visit, visit_count, created_at, updated_at

**plan**：id, customer_id, plan_date（YYYY-MM-DD）, plan_time（HH:mm|null）, visit_way, status（待执行/已完成）, created_at

**visit_record**：id, customer_id, plan_id, visit_date, visit_time, visit_way, duration, summary, stage, comm_result（smooth/normal/blocked/deal）, record_type（planned/adhoc）, is_deal（签单成交/暂未成交）, deal_products, deal_premium, policy_effective_date, next_follow_date, has_objection, objection_ids（Array）, created_at

**policy**：id, customer_id, product_type（中文，向后兼容）, category（英文枚举），product_name, premium, effective_date, coverage_term（Object）, payment_term（Object）, status（draft/active/expired）, source（self/external）, visit_record_id, created_at

**segment**：id, name, color, rules（JSON，含 version/match/rules 嵌套结构）, sort（Object）, is_system, created_at, updated_at

**objection_note**：id, objection_id, customer_id, note, result（已化解/仍在考虑/未化解）, created_at

### 4.3 跨表关联

```
customer ──1:N──→ plan, visit_record, objection, objection_note, operation_log, policy
plan ──1:0..1──→ visit_record（plan.id = visit_record.plan_id）
objection ──1:N──→ objection_note
预置异议 ──1:N──→ objection_links（presetId 分组计数）
policy(self) ──N:1──→ visit_record（policy.visit_record_id = visit_record.id）
segment ── 独立表，不与业务实体关联
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
│   ├── → record-new?record_type=adhoc（快捷 +记录）
│   └── → segment-edit（视图管理）
├── 日历（calendar）
│   ├── → customer-detail（点击计划事件）
│   └── → visit-record/detail（点击记录事件）
├── 节奏（rhythm）
│   └── → customer-detail（客户卡片）
└── 复盘（review）
    └── 独立页面，无跳转

customer-detail（5 Tab）
├── → record-new（执行计划 / 随手记）
├── → objection-detail（异议详情）
├── → objection-new（新建异议）
├── → plan-select（新建计划）
└── → policy-edit（他渠道保单录入）

record-new
├── → objection/select（选择关联异议）
└── → plan-select（选择关联计划）

objection/index（异议池）
├── → objection-new（新建异议）
└── → objection-detail（异议详情）
```

---

## 6. 技术约束

| 约束 | 说明 |
|------|------|
| 原生小程序 | WXML / WXSS / JS，禁止 React / Vue / TypeScript |
| 无 npm 业务逻辑包 | 第三方 UI 组件（Vant Weapp）已通过 miniprogram_npm 构建 |
| CSS 变量 | 所有颜色/间距/圆角必须引用 `styles/variables.wxss`，禁止写死数值 |
| Repository 层 | 页面禁止直接调用 storage，只能通过 `utils/repository/*` |
| 事务写入 | 多表写入必须使用 `storage.transaction()` |
| Storage 上限 | 单 key 1MB，总计 10MB；内置容量预警（800KB warn / 950KB critical） |
| 基础库版本 | 最低 2.10.0 |

---

*详细字段定义和跨表关系见 [DATA_RELATIONSHIP.md](DATA_RELATIONSHIP.md)。*  
*架构实现细节见 [ARCHITECTURE_DESIGN.md](ARCHITECTURE_DESIGN.md)。*

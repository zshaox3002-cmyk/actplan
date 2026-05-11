# 数据关系表 — actplan 微信小程序

> **生成时间**：2026-04-27 | **最后更新**：2026-05-11（v1.3 双轴时间模型 + 云同步）  
> **更新规则**：修改数据结构时请同步更新此表；需要重新扫描时由人类指令触发

---

## 1. Storage 表清单

| # | 表名 | Storage Key | 说明 | ID 格式 |
|---|------|------------|------|---------|
| 1 | `customer` | `db_customer` | 客户信息 | 自增数字（id.js） |
| 2 | `visit_record` | `db_visit_record` | 拜访记录 | 自增数字（id.js） |
| 3 | `plan` | `db_plan` | 拜访计划 | 自增数字（id.js） |
| 4 | `objection` | `db_objection` | 用户自建异议 | 自增数字（id.js） |
| 5 | `objection_note` | `db_objection_note` | 异议追加备注 | 自增数字（id.js） |
| 6 | `objection_links` | `db_objection_links` | 预置异议计数链接 | 无自增 ID |
| 7 | `operation_log` | `db_operation_log` | 操作日志 | 自增数字（id.js） |
| 8 | `policy` | `db_policy` | 保单实体（v1.1 新增） | 自增数字（id.js） |
| 9 | `segment` | `db_segment` | 客户视图（v1.1 新增） | 自增数字（id.js） |

**辅助存储**：
- `db_meta` → `{ nextId: { customer: N, ..., policy: 0, segment: 0 }, version: 2, segment_index: {}, derived_cache: {} }` — ID 计数器 + 版本号 + 视图索引缓存 + 派生字段 LRU 缓存

---

## 2. 各表字段定义

### 2.1 customer

| 字段 | 类型 | 默认值 | 说明 | 枚举值来源 |
|------|------|--------|------|-----------|
| `id` | number | id.nextId() | 主键 | — |
| `name` | string | `''` | 姓名（必填） | — |
| `gender` | string | `''` | 性别 | customer-detail: `['男','女','未知']` |
| `relation` | string | `''` | 关系 | customer-detail: `['同事','朋友','亲戚','同学','邻居','客户介绍','陌生拜访','其他']` |
| `income` | string | `''` | 收入 | customer-detail: `['10万以下','10–30万','30–50万','50–100万','100–300万','300万以上','未知']` |
| `age_range` | string | `''` | 年龄范围 | customer-detail: `['25岁以下','25–34岁','35–44岁','45–54岁','55–64岁','65岁以上']` |
| `occupation` | string | `''` | 职业 | customer-detail: `['企业职员','企业管理层','个体经营','自由职业','医疗/教育/公务员','金融从业者','工程技术','全职家庭','学生','其他']` |
| `residence` | string | `''` | 居住类型 | customer-detail: `['自住房（无贷）','自住房（有贷）','租房','与父母同住','其他']` |
| `marital` | string | `''` | 婚姻状况 | customer-detail: `['未婚','已婚–无子','已婚–有子','离异','丧偶']` |
| `intimacy` | string | `''` | 交情 | customer-detail: `['陌生','普通朋友','熟人','好友','亲密']` |
| `apple_grade` | string | `'pending'` | 苹果等级 | `red`/`green`/`rotten`/`pending` |
| `stage` | string | `'需求沟通'` | 跟进阶段 | `初步认识`/`需求沟通`/`方案讲解`/`待促成`/`已成交`/`已流失` |
| `stage_updated_at` | string|null | `null` | 阶段更新时间 | ISO 8601 |
| `family` | string | `''` | 家庭成员 | customer-detail: `['单身','夫妻二人','有未成年子女','有成年子女','与父母同住','三代同堂']` |
| `has_need` | string | `'不确定'` | 有无需求 | `是`/`否`/`不确定` |
| `has_ability` | string | `'不确定'` | 有无购买力 | `是`/`否`/`不确定` |
| `is_decider` | string | `'不确定'` | 是否决策人 | `是`/`否`/`不确定` |
| `coverage_gap` | string | `''` | 保障缺口说明 | 自由文本 |
| `tags` | Array | `[]` | 客户自定义标签 | 自由文本数组 |
| `coverage_needs` | Object | `{}` | 保障需求（**v1.0 字段，v1.1 迁移后废弃**） | key 为险种（重疾/医疗/教育金/养老/意外/寿险），value 为需求等级（`关注中`/`有兴趣`/`待了解`/`暂不考虑`） |
| `coverage_status` | Object | `{ 重疾:'unknown', 医疗:'unknown', 教育金:'unknown', 养老:'unknown', 意外:'unknown', 寿险:'unknown' }` | 保障状态（**v1.1 新增，替代 coverage_needs**） | 每项险种值为 `configured`（系统自动）/`gap`（代理人手动）/`none`（代理人手动）/`unknown`（默认） |
| `is_hnw` | boolean | `false` | 是否高净值（**v1.1 新增**） | — |
| `referral_count` | number | `0` | 转介绍次数（**v1.1 新增**） | — |
| `birthday` | string\|null | `null` | 生日（**v1.1 新增**） | MM-DD 格式 |
| `policy_expire_date` | string\|null | `null` | 最近保单到期日（**v1.1 新增**，手动维护） | YYYY-MM-DD |
| `last_visit` | string|null | `null` | 最近拜访日期 | YYYY-MM-DD |
| `visit_count` | number | `0` | 拜访次数 | — |
| `created_at` | string | nowISO() | 创建时间 | ISO 8601 |
| `updated_at` | string | nowISO() | 更新时间 | ISO 8601 |

**派生字段（不持久化，由 db_policy 实时聚合）**：
- `policy_count` — 已成交保单数（count(*)）
- `total_premium` — 累计保费（sum(premium)）
- `avg_premium` — 件均保费（total_premium / policy_count）
- `first_policy_date` — 首单日期（min(effective_date)）

> 以上派生字段通过 `customerRepo.getCustomerWithDerived(id)` 统一获取，禁止页面自行聚合。

**DISABLED 字段**（代码中注释保留，未启用）：
- `follow_date` / `todo_task` / `objection_legacy` / `apple_rank_overridden`
- `coverage` (Array) / `gap` (Array) — 已合并为 `coverage_gap`

**兼容字段**（旧数据可能存在）：
- `apple_rank` — 旧苹果等级（中文标签），与 `apple_grade`（value）共存，读取时优先 `apple_grade`

### 2.2 visit_record

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `id` | number | id.nextId() | 主键 |
| `customer_id` | number | — | 关联客户 ID |
| `plan_id` | number\|null | `null` | 关联计划 ID |
| `visit_date` | string | — | 拜访日期 YYYY-MM-DD |
| `visit_time` | string\|null | `null` | 拜访时间 HH:mm，由 plan.plan_time 继承 |
| `visit_way` | string | `'面对面'` | 拜访方式 |
| `duration` | number\|null | `null` | 拜访时长（分钟） |
| `summary` | string | `''` | 沟通摘要 |
| `stage` | string | `''` | 当时跟进阶段 |
| `updated_fields` | Array | `[]` | 本次更新的客户字段 |
| `is_deal` | string | `'暂未成交'` | 成交状态 | `签单成交`/`暂未成交` |
| `next_follow_date` | string\|null | `null` | 下次跟进日期 |
| `has_objection` | number | `0` | 是否关联异议 |
| `objection_ids` | Array\<number\|string\> | `[]` | 本次拜访关联的异议 ID 列表 |
| `comm_result` | string | `''` | 沟通结果 | `smooth`（进展顺利）/`normal`（一般）/`blocked`（受阻）/`deal`（已成交） |
| `record_type` | string | `'planned'` | 记录类型 | `planned`（计划内拜访）/`adhoc`（临时沟通） |
| `deal_products` | Array | `[]` | 成交险种（**v1.1 新增**，仅 comm_result='deal' 时填写） | 枚举数组，值为险种名 |
| `deal_premium` | number\|null | `null` | 保费金额（**v1.1 新增**，仅 comm_result='deal' 时填写） | 元 |
| `policy_effective_date` | string\|null | `null` | 保单生效日期（**v1.1 新增**，仅 comm_result='deal' 时填写） | YYYY-MM-DD |
| `created_at` | string | nowISO() | 创建时间 |

### 2.3 plan

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `id` | number | id.nextId() | 主键 |
| `customer_id` | number | — | 关联客户 ID |
| `plan_date` | string | — | 计划日期 YYYY-MM-DD |
| `plan_time` | string\|null | `null` | 计划时间 HH:mm，空表示未指定时间/全天计划 |
| `visit_way` | string | `'面对面'` | 拜访方式 |
| `status` | string | `'待执行'` | 计划状态：`待执行`/`已完成` |
| `created_at` | string | nowISO() | 创建时间 |

### 2.4 objection（用户自建异议）

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `id` | number | id.nextId() | 主键（数字） |
| `customer_id` | number\|null | `null` | 关联客户 ID |
| `content` | string | `''` | 异议内容 |
| `category` | string | `'其他'` | 异议分类 |
| `solution` | string | `''` | 应对话术 |
| `count` | number | `1` | 出现次数 |
| `isPreset` | — | — | 预置标识（仅预置异议有） |
| `created_at` | string | nowISO() | 创建时间 |

**预置异议**（`objection-preset.js`，不在 storage 中）：
- `id`: 字符串格式如 `preset_price_01`
- 额外字段：`isPreset: true`, `isOfficial: true`, `title`
- 出现次数通过 `objection_links` 表统计

### 2.5 objection_note

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `id` | number | id.nextId() | 主键 |
| `objection_id` | number\|string | — | 关联异议 ID（数字=自建，字符串=预置） |
| `customer_id` | number | — | 关联客户 ID |
| `note` | string | — | 备注内容 |
| `result` | string | `''` | 处理结果 | `已化解`/`仍在考虑`/`未化解` |
| `created_at` | string | nowISO() | 创建时间 |

### 2.6 objection_links

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `presetId` | string | — | 预置异议 ID（如 `preset_price_01`） |
| `created_at` | string | nowISO() | 创建时间 |

> 注：此表无自增 ID，每行代表一次预置异议被引用的记录，计数通过 `presetId` 分组统计

### 2.7 operation_log

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `id` | number | id.nextId() | 主键 |
| `customer_id` | number | — | 关联客户 ID |
| `field` | string | `''` | 修改字段 |
| `old_value` | string | `''` | 旧值 |
| `new_value` | string | `''` | 新值 |
| `created_at` | string | nowISO() | 创建时间 |

### 2.8 policy（v1.1 新增，v1.3 双轴时间模型扩展）

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `id` | number | id.nextId() | 主键 |
| `customer_id` | number | — | 关联客户 ID |
| `product_type` | string | — | 旧险种枚举（中文）：`重疾`/`医疗`/`教育金`/`养老`/`意外`/`寿险`；v1.3 后优先使用 `category` |
| `category` | string | 由 product_type 推导 | **v1.3 新增**。险种英文枚举：`medical`/`critical_illness`/`term_life`/`whole_life`/`annuity`/`accident`/`education` |
| `product_name` | string | `''` | 产品名（可空，如"友邦传世盈佳"） |
| `premium` | number | — | 年缴保费（元，必填） |
| `effective_date` | string | — | 生效日期 YYYY-MM-DD（必填） |
| `expire_date` | string\|null | `null` | 保留向后兼容，新数据由 `coverage_term` 自动推导 |
| `coverage_term` | Object | 由险种模板默认 | **v1.3 新增**。保障期：`{ type: 'lifetime'|'years'|'to_age'|'same_as_coverage', value: number|null }` |
| `payment_term` | Object | 由险种模板默认 | **v1.3 新增**。缴费期：`{ type: 'years'|'single'|'same_as_coverage', value: number|null }` |
| `status` | string | `'active'` | **v1.3 新增**。保单状态：`draft`/`active`/`expired` |
| `source` | string | — | 来源：`self`（我成交）/`external`（他渠道） |
| `visit_record_id` | number\|null | `null` | source='self' 时关联成交拜访记录 ID；external 为 null |
| `created_at` | number | Date.now() | 创建时间戳 |

**险种模板默认值**（`policy-templates.js`）：

| category | coverage_term | payment_term |
|----------|--------------|--------------|
| `medical` | `years:1` | `same_as_coverage` |
| `critical_illness` | `lifetime` | `years:20` |
| `term_life` | `to_age:60` | `years:20` |
| `whole_life` | `lifetime` | `years:10` |
| `annuity` | `lifetime` | `single` |
| `accident` | `years:1` | `same_as_coverage` |
| `education` | `to_age:18` | `years:10` |

**关键规则**：
- source='self' 的保单由成交拜访记录事务性自动创建，不可手动新建
- source='external' 的保单通过 policy-edit 页面手动录入
- 删除 self 保单时，若该险种无其他保单记录，自动将 customer.coverage_status[险种] 回滚为 unknown
- 写入任意保单后，对应险种的 customer.coverage_status 自动更新为 configured
- `policyRepo.listWithComputed()` 返回附加派生字段（`_category`/`_coverage_term`/`_payment_term`/`_payment_end_date`/`_card_status`/`_policy_year`/`_policy_summary`/`_needs_completion`），以 `_` 前缀标识，不持久化

### 2.9 segment（v1.1 新增）

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `id` | number | id.nextId() | 主键 |
| `name` | string | — | 视图名（必填，最长 12 字） |
| `color` | string\|null | `null` | 颜色标记：`gold`/`purple`/`blue`/`green`/`gray`；系统预设为 null |
| `rules` | Object | — | 规则 JSON（结构见下方） |
| `sort` | Object | — | 排序规则 JSON：`{ field, order: 'asc'|'desc' }` |
| `is_system` | boolean | `false` | 是否系统预设（true 不可删，仅可编辑 rules/sort） |
| `created_at` | number | Date.now() | 创建时间戳 |
| `updated_at` | number | Date.now() | 更新时间戳 |

**rules JSON 结构**：
```json
{
  "version": 1,
  "match": "AND|OR",
  "rules": [
    { "field": "coverage_status.养老", "op": "eq", "value": "gap" },
    { "field": "policy_count", "op": "gte", "value": 2 },
    {
      "match": "OR",
      "rules": [
        { "field": "total_premium", "op": "gte", "value": 50000 },
        { "field": "policy_count", "op": "gte", "value": 2 }
      ]
    }
  ],
  "sort": { "field": "avg_premium", "order": "desc" }
}
```

支持嵌套子组（用于表达 OR 子条件）。`version` 字段必须存在，便于未来规则结构升级时兼容旧数据。

**系统预设视图（v1.1 初始化写入，is_system=true）**：

| 视图名 | 规则摘要 | 排序 |
|--------|---------|------|
| 沉睡金子 | (total_premium ≥ 50000 OR policy_count ≥ 2) AND days_since_last_visit ≥ 60 AND stage ≠ 已流失 | total_premium 降序 |
| 重要客户 | is_hnw=true OR intimacy ≥ 4 OR total_premium ≥ 50000 | total_premium 降序 |
| 高价值缺口 | coverage_status 任一险种=gap AND policy_count ≥ 2 | total_premium 降序 |

**自建视图上限**：10 个（is_system=false 的记录数），超出时新建按钮置灰。

---

## 3. 跨表关联关系

```
customer ──1:N──→ plan             (customer.id = plan.customer_id)
customer ──1:N──→ visit_record     (customer.id = visit_record.customer_id)
customer ──1:N──→ objection        (customer.id = objection.customer_id)
customer ──1:N──→ objection_note   (customer.id = objection_note.customer_id)
customer ──1:N──→ operation_log    (customer.id = operation_log.customer_id)
customer ──1:N──→ policy           (customer.id = policy.customer_id)  [v1.1]

plan ──1:0..1──→ visit_record      (plan.id = visit_record.plan_id)

objection ──1:N──→ objection_note  (objection.id = objection_note.objection_id)
预置异议 ──1:N──→ objection_links  (presetId = objection_links.presetId)

policy ──N:0..1──→ visit_record    (policy.visit_record_id = visit_record.id，仅 source='self')  [v1.1]

segment ── 独立表，不与业务实体关联  [v1.1]
```

---

## 4. 跨表事务操作

| 事务 | 触发位置 | 涉及表 | 操作说明 |
|------|---------|--------|---------|
| **新建拜访记录** | `record.repo.create()` | visit_record, customer, plan | ① 插入记录 ② 更新 customer.last_visit/visit_count ③ 若成交则更新 customer.stage ④ 若有 plan_id 则更新 plan.status='已完成' |
| **新建拜访记录（成交）** | `record-new/index.js onSave()` | visit_record, customer, plan, policy | 在上条基础上追加：⑤ 为 deal_products 中每个险种创建 policy 记录（source='self'）⑥ 更新 customer.coverage_status[险种]='configured'（**v1.1 新增**） |
| **追加异议备注** | `objection.repo.appendNote()` | objection_note, objection 或 objection_links | ① 插入 note ② 自建异议→objection.count+=1；预置异议→插入 objection_links |
| **删除客户** | `customer.repo.deleteCustomer()` | customer, plan, visit_record | ① 删除客户 ② 级联删除关联 plan ③ 级联删除关联 visit_record |
| **录入他渠道保单** | `policy-edit/index.js onSave()` | policy, customer, operation_log | ① 写入 policy（source='external'）② 更新 customer.coverage_status[险种]='configured' ③ 写入 operation_log（**v1.1 新增**） |
| **删除保单** | `customer-detail/index.js onPolicyDelete()` | policy, customer | ① 删除 policy ② 若该险种无其他保单则回滚 customer.coverage_status[险种]='unknown'（**v1.1 新增**） |

---

## 5. 非事务跨表操作

| 操作 | 触发位置 | 涉及表 | 说明 |
|------|---------|--------|------|
| **新建拜访记录后** | `record-new/index.js onSave()` | customer, plan, objection | ① `customerRepo.update(stage)` ② 若有 nextDate 则 `planRepo.create()` ③ 若有异议则 `objectionRepo.create()` |
| **预置异议计数+1** | `objection.repo.incrementCount()` | objection_links | 直接插入一条 link 记录 |
| **异议选择确认** | `objection/select/index.js onConfirm()` | objection_links | 对选中的预置异议调用 `incrementCount()` |

> ⚠️ **注意**：`record-new/index.js` 中的多表操作不是事务，如果中途失败可能导致数据不一致

---

## 6. 页面数据引用

| 页面 | 读取的表（通过 repo） | 写入的表 | 特别说明 |
|------|---------------------|---------|---------|
| `pages/customer/index` | customer (R), policy (R via derived), segment (R) | customer (D) | v1.1：视图切换器需批量计算派生字段 |
| `pages/customer-detail/index` | customer (R/W), operation_log (W), policy (R/C/D) | customer (C/U), policy (C/D) | v1.1：画像 Tab 新增保单区块、保障状态、扩展字段 |
| `pages/dashboard/index` | customer, visit_record, plan, objection, objection_note, objection_links (均通过 stats.js R) | 无 | stats.js 一次性快照 |
| `pages/rhythm/index` | customer (R), visit_record (R) | 无 | rhythm.js 分类计算 |
| `pages/review/index` | customer, visit_record, plan, objection, objection_note, operation_log (均 R) | 无 | review-stats.js 统计 |
| `pages/plan-select/index` | customer (R), plan (R) | plan (C) | — |
| `pages/record-new/index` | customer (R/W), plan (R/W), record (C), objection (C/R), policy (C) | 多表 | v1.1：成交时事务性写入 policy + 更新 coverage_status |
| `pages/record/index` | visit_record (R), customer (R) | 无 | — |
| `pages/objection/index` | objection (R), objection_links (R) | objection (D) | — |
| `pages/objection-new/index` | customer (R), objection (R/C) | objection (C), objection_note (C via appendNote) | — |
| `pages/objection-detail/index` | objection (R), objection_note (R), customer (R) | 无 | — |
| `pages/objection/select/index` | objection (R), objection_links (W via incrementCount) | objection_links | — |
| `pages/visit-record/detail/index` | visit_record (R), customer (R), plan (**直接 storage.getTable**), objection (R) | 无 | ⚠️ 绕过 repo 层直接读 plan |
| `pages/segment-edit/index` | customer (R via derived), segment (R/C/U) | segment | v1.1 新页面：视图编辑器，底部实时预览命中数 |
| `pages/policy-edit/index` | policy (R/C/U), customer (W) | policy, customer, operation_log | v1.1 新页面：他渠道保单录入/编辑 |

---

## 7. 组件数据引用

| 组件 | 关联的表字段 | 说明 |
|------|------------|------|
| `customer-card` | customer: apple_grade, stage, phone, visit_count, last_visit, occupation, age_range, income, marital | 通过 properties.customer 传入 |
| `plan-card` | plan: id, customer_id, plan_date, visit_way, status | 通过 properties.plan 传入 |
| `record-card` | visit_record: id 等; customer.name | 通过 properties.record/customerName 传入 |
| `objection-card` | objection: id, category, content, count, isPreset | 通过 properties.objection 传入 |
| `chart-pie` | 通用 [{name, value, color}] | Dashboard 苹果分布/异议分布 |
| `chart-bar` | 通用 [{name, value}] 或 [{label, planCount, visitCount}] | Dashboard 异议分布/拜访趋势 |
| 其他组件 | 无直接数据模型关联 | 纯 UI 组件 |

> **已删除组件**：`filter-bar` — v1.1 后客户页筛选区改为 segment 视图 Chip，filter-bar 组件已移除。

---

## 8. 特殊映射关系

### 8.1 apple_grade 值映射

| apple_grade (存储值) | 中文标签 | CSS class (customer-card) | 颜色 |
|---------------------|---------|--------------------------|------|
| `red` | 红苹果 | `red` | #E74C3C |
| `green` | 青苹果 | `green` | #27AE60 |
| `rotten` | 烂苹果 | `brown` | #92400E / #6B7280 |
| `pending` | 待定 | `yellow` | #F39C12 |

**兼容处理位置**：customer.repo.js list()、stats.js getAppleDistribution()、objection-new/index.js、customer-card/index.js

### 8.2 stage 值映射

| 存储值 | 显示文字 | CSS class |
|--------|---------|-----------|
| 初步认识 | 初步认识 | meet |
| 需求沟通 | 需求沟通 | comm |
| 方案讲解 | 方案讲解 | present |
| 待促成 | 待促成 | closing |
| 已成交 | 已成交 | deal |
| 已流失 | 已流失 | lost |

**映射来源**：`constants.js` → `STAGE_CLASS_MAP`

### 8.3 异议分类 CSS 映射

| 分类 | CSS class |
|------|-----------|
| 价格 | price / tag-red |
| 必要性 | necessity / tag-yellow |
| 时机 | timing / tag-blue |
| 产品对比 | compare / tag-purple |
| 信任 | trust / tag-green |
| 其他 | other / tag-gray |

---

## 9. 数据流关键路径

```
[客户列表页] → customerRepo.list() → customer 表
              → segmentRepo.listAll() → segment 表（v1.1）
              → 批量 policyRepo.getDerived() → policy 表（v1.1）
              → segment.applySegment() → 内存过滤（v1.1）
[客户详情页] → customerRepo.getCustomerWithDerived() → customer + policy 表（v1.1）
              → policyRepo.list(customerId) → policy 表（v1.1）
[拜访计划页] → planRepo.list/listWeek() → plan 表 + customer 表(关联名)
[新建计划] → planRepo.create() → plan 表
[执行计划] → record-new 页 → recordRepo.create() → visit_record + customer + plan (事务)
                                       → policyRepo.create() (成交时，事务内，v1.1)
                                       → customerRepo.update(coverage_status) (成交时，事务内，v1.1)
                                       → customerRepo.update() (阶段同步)
                                       → planRepo.create() (自动创建下次计划)
                                       → objectionRepo.create() (异议写入)
[保单录入] → policy-edit 页 → policyRepo.create/update() → policy 表（v1.1）
                             → customerRepo.update(coverage_status) → customer 表（v1.1）
[视图编辑] → segment-edit 页 → segmentRepo.create/update() → segment 表（v1.1）
[异议池] → objectionRepo.list() → objection 表 + objection_links 表(预置计数) + PRESET_OBJECTIONS
[异议详情] → objectionRepo.get/listNotes() → objection/objection_note 表 + customer 表(关联名)
[异议选择] → objectionRepo.incrementCount() → objection_links 表
[Dashboard] → stats.getStatsSnapshot() → customer + visit_record + plan + objection + objection_note + objection_links
```

---

## 10. 已知风险点

| # | 风险 | 位置 | 说明 |
|---|------|------|------|
| 1 | ~~绕过 repo 直接操作 storage~~ ✅ 已修复 | `pages/visit-record/detail/index.js:81` | 改为 `planRepo.list(date)` + filter + objectionRepo.get(ids) |
| 2 | ~~非事务多表写入~~ ✅ 已修复 | `pages/record-new/index.js:142` | 外层包 `storage.transaction()`，异议处理+记录创建+客户更新+计划创建原子化 |
| 3 | **枚举值分散定义** | customer-detail/index.js | 各 picker 的选项数组硬编码在页面 data 中，未统一使用 constants.js |
| 4 | **apple_grade 旧格式兼容** | customer.repo.js, stats.js, objection-new/index.js | 多处存在 `apple_rank`(中文) ↔ `apple_grade`(value) 兼容代码 |
| 5 | **stage 旧格式兼容** | customer-card/index.js | STAGE_DISPLAY 映射包含 need/touch/deal/1/2/3 等旧值 |
| 6 | **coverage_needs 废弃字段** | customer 表 | v1.1 迁移后 coverage_needs 字段废弃，由 coverage_status 替代；旧数据按映射规则迁移（关注中/有兴趣/待了解→gap，暂不考虑→none，未填写→unknown） |
| 7 | **派生字段禁止自行聚合** | 所有读取 policy_count 等字段的页面 | 必须通过 `customerRepo.getCustomerWithDerived(id)` 统一获取，禁止页面直接读 db_policy 聚合 |

---

---

## 12. 云同步架构（v1.3 新增）

### 12.1 总体架构

`utils/cloud-sync.js` 实现本地优先 + 云端备份模式：

- **写入路径**：本地写入（同步）→ 标记 dirty → 防抖 3s 后上传云端
- **失败处理**：保留 dirty 标记，onHide/onShow 时自动 flush 重试
- **恢复路径**：App 启动时本地为空 → 从云端 `table_backup` 拉取全量数据

**云开发环境**：`pro-d1g97lgrm3a7cf83a`  
**云数据库集合**：`table_backup`，文档结构 `{ _openid, table_name, data, updated_at }`  
**云函数**：`login`（获取 openid）

### 12.2 去重工具（`utils/dedup-records.js`）

一次性清理工具，在 App 启动时执行，用 `db_meta.dedup_v1_done` 守卫防重复：

- **去重键**：`customer_id + visit_date + visit_time + summary`（完全相同才视为重复）
- **策略**：保留 id 最小（最早创建）的那条，删除后续重复 record 及其关联 policy
- **异议去重**：`runObjectionDedup()`，用 `db_meta.dedup_objection_v1_done` 守卫

---

## 11. v1.1 数据迁移规则（v1.0 → v1.1）

通过 `storage.js` 的 `migrate(2)` 钩子在 `init()` 末尾执行，仅当 `db_meta.version < 2` 时触发。

### 11.1 customer 表字段迁移

新增字段以默认值补齐：

| 字段 | 默认值 |
|------|--------|
| `is_hnw` | `false` |
| `referral_count` | `0` |
| `birthday` | `null` |
| `policy_expire_date` | `null` |
| `coverage_status` | 按下方映射规则从 coverage_needs 转换 |

`coverage_needs` → `coverage_status` 映射：

| v1.0 coverage_needs 值 | v1.1 coverage_status 值 |
|------------------------|------------------------|
| `关注中` / `有兴趣` / `待了解` | `gap` |
| `暂不考虑` | `none` |
| 未填写 / 空 | `unknown` |

### 11.2 visit_record 表

历史 `comm_result='deal'` 记录的 `deal_products` / `deal_premium` / `policy_effective_date` 三字段保持空值，不阻断展示，不自动生成 db_policy 记录。

### 11.3 db_segment 初始化

写入 3 条系统预设视图（is_system=true），详见 §2.9。

### 11.4 db_meta 版本号

写入 `db_meta.version = 2`，后续 migrate 钩子据此判断是否已迁移。

# 数据关系表 — actplan 微信小程序

> **生成时间**：2026-04-27 | **触发方式**：全局代码扫描  
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

**辅助存储**：
- `db_meta` → `{ nextId: { customer: N, ... }, version: 1 }` — ID 计数器 + 版本号

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
| `stage` | string | `'需求沟通'` | 跟进阶段 | constants.STAGE / customer-detail: `['需求沟通','方案呈现','异议处理','促成签单','已成交','已拒绝']` |
| `stage_updated_at` | string|null | `null` | 阶段更新时间 | ISO 8601 |
| `family` | string | `''` | 家庭成员 | customer-detail: `['单身','夫妻二人','有未成年子女','有成年子女','与父母同住','三代同堂']` |
| `has_need` | string | `'不确定'` | 有无需求 | `是`/`否`/`不确定` |
| `has_ability` | string | `'不确定'` | 有无购买力 | `是`/`否`/`不确定` |
| `is_decider` | string | `'不确定'` | 是否决策人 | `是`/`否`/`不确定` |
| `coverage_gap` | string | `''` | 保障缺口说明 | 自由文本 |
| `last_visit` | string|null | `null` | 最近拜访日期 | YYYY-MM-DD |
| `visit_count` | number | `0` | 拜访次数 | — |
| `created_at` | string | nowISO() | 创建时间 | ISO 8601 |
| `updated_at` | string | nowISO() | 更新时间 | ISO 8601 |

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
| `visit_way` | string | `'面对面'` | 拜访方式 |
| `duration` | number\|null | `null` | 拜访时长（分钟） |
| `summary` | string | `''` | 沟通摘要 |
| `stage` | string | `''` | 当时跟进阶段 |
| `updated_fields` | Array | `[]` | 本次更新的客户字段 |
| `is_deal` | string | `'暂未成交'` | 成交状态 |
| `next_follow_date` | string\|null | `null` | 下次跟进日期 |
| `has_objection` | number | `0` | 是否关联异议 |
| `objection_ids` | Array\<number\|string\> | `[]` | 本次拜访关联的异议 ID 列表 |
| `created_at` | string | nowISO() | 创建时间 |

### 2.3 plan

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `id` | number | id.nextId() | 主键 |
| `customer_id` | number | — | 关联客户 ID |
| `plan_date` | string | — | 计划日期 YYYY-MM-DD |
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

---

## 3. 跨表关联关系

```
customer ──1:N──→ plan             (customer.id = plan.customer_id)
customer ──1:N──→ visit_record     (customer.id = visit_record.customer_id)
customer ──1:N──→ objection        (customer.id = objection.customer_id)
customer ──1:N──→ objection_note   (customer.id = objection_note.customer_id)
customer ──1:N──→ operation_log    (customer.id = operation_log.customer_id)

plan ──1:0..1──→ visit_record      (plan.id = visit_record.plan_id)

objection ──1:N──→ objection_note  (objection.id = objection_note.objection_id)
预置异议 ──1:N──→ objection_links  (presetId = objection_links.presetId)
```

---

## 4. 跨表事务操作

| 事务 | 触发位置 | 涉及表 | 操作说明 |
|------|---------|--------|---------|
| **新建拜访记录** | `record.repo.create()` | visit_record, customer, plan | ① 插入记录 ② 更新 customer.last_visit/visit_count ③ 若成交则更新 customer.stage ④ 若有 plan_id 则更新 plan.status='已完成' |
| **追加异议备注** | `objection.repo.appendNote()` | objection_note, objection 或 objection_links | ① 插入 note ② 自建异议→objection.count+=1；预置异议→插入 objection_links |
| **删除客户** | `customer.repo.deleteCustomer()` | customer, plan, visit_record | ① 删除客户 ② 级联删除关联 plan ③ 级联删除关联 visit_record |

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
| `pages/customer/index` | customer (R) | customer (D) | D=删除 |
| `pages/customer-detail/index` | customer (R/W), operation_log (W) | customer (C/U) | C=创建 U=更新 |
| `pages/dashboard/index` | customer, visit_record, plan, objection, objection_note, objection_links (均通过 stats.js R) | 无 | stats.js 一次性快照 |
| `pages/plan/index` | plan (R), customer (R), visit_record (R) | plan (D) | — |
| `pages/plan-select/index` | customer (R), plan (R) | plan (C) | — |
| `pages/record-new/index` | customer (R/W), plan (R/W), record (C), objection (C/R) | 多表 | 事务写入（storage.transaction），含 objection_ids |
| `pages/record/index` | visit_record (R), customer (R) | 无 | — |
| `pages/objection/index` | objection (R), objection_links (R) | objection (D) | — |
| `pages/objection-new/index` | customer (R), objection (R/C) | objection (C), objection_note (C via appendNote) | — |
| `pages/objection-detail/index` | objection (R), objection_note (R), customer (R) | 无 | — |
| `pages/objection/select/index` | objection (R), objection_links (W via incrementCount) | objection_links | — |
| `pages/visit-record/detail/index` | visit_record (R), customer (R), plan (**直接 storage.getTable**), objection (R) | 无 | ⚠️ 绕过 repo 层直接读 plan |

---

## 7. 组件数据引用

| 组件 | 关联的表字段 | 说明 |
|------|------------|------|
| `customer-card` | customer: apple_grade, stage, phone, visit_count, last_visit, occupation, age_range, income, marital | 通过 properties.customer 传入 |
| `plan-card` | plan: id, customer_id, plan_date, visit_way, status | 通过 properties.plan 传入 |
| `record-card` | visit_record: id 等; customer.name | 通过 properties.record/customerName 传入 |
| `objection-card` | objection: id, category, content, count, isPreset | 通过 properties.objection 传入 |
| `filter-bar` | customer: apple_grade (筛选), stage (筛选) | 通过 properties 传入筛选值 |
| `chart-pie` | 通用 [{name, value, color}] | Dashboard 苹果分布/异议分布 |
| `chart-bar` | 通用 [{name, value}] 或 [{label, planCount, visitCount}] | Dashboard 异议分布/拜访趋势 |
| 其他组件 | 无直接数据模型关联 | 纯 UI 组件 |

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
| 需求沟通 | 需求沟通 | need |
| 方案呈现 | 方案呈现 | — |
| 异议处理 | 异议处理 | — |
| 促成签单 | 促成签单 | — |
| 已成交 | 已成交 | deal |
| 已拒绝 | 已拒绝 | reject |

**兼容处理位置**：customer-card/index.js（映射旧格式 need/touch/deal/1/2/3）、filter-bar/index.js

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
[客户详情页] → customerRepo.get/update/create/delete() → customer 表 + operation_log 表
[拜访计划页] → planRepo.list/listWeek() → plan 表 + customer 表(关联名)
[新建计划] → planRepo.create() → plan 表
[执行计划] → record-new 页 → recordRepo.create() → visit_record + customer + plan (事务)
                                       → customerRepo.update() (阶段同步)
                                       → planRepo.create() (自动创建下次计划)
                                       → objectionRepo.create() (异议写入)
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

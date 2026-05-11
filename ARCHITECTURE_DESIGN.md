# 保险代理人活动管理小程序 — 开发架构设计 v1.3

> 基于 PRD v1.1 + UI_SPEC v1.0 + rules.md 约束  
> 设计日期：2026-04-23 | 最后更新：2026-05-11（v1.3 云同步 + 双轴时间模型）

---

## 一、架构设计原则

| 原则 | 说明 |
|------|------|
| **Simplicity First** | 最小代码解决问题，不引入未请求的抽象和配置 |
| **本地优先** | 所有读写走本地 Storage（同步），云端为异步备份，不阻塞主流程 |
| **组件复用** | 高频 UI 模式抽取为组件，避免重复实现 |
| **可测试** | 核心业务逻辑（苹果分级、统计计算、视图规则）独立为纯函数 |
| **分层解耦** | Repository 层屏蔽存储细节；CloudSync 层封装云开发细节 |

---

## 二、技术选型

| 层级 | 技术方案 | 选型理由 |
|------|---------|---------|
| **框架** | 微信小程序原生开发 | PRD 无跨平台需求，原生开发 bundle 最小、调试最直接 |
| **UI 语言** | WXML + WXSS | 原生方案，与 UI_SPEC 的 CSS 变量体系直接对应 |
| **本地存储** | `wx.getStorageSync` + JSON 序列化 | 零依赖、零兼容性问题；数据量（预估 <500 客户）完全在 Storage 限制内 |
| **云存储** | 微信云开发（`wx.cloud`）+ `table_backup` 集合 | 官方方案，无需额外后端；用于跨设备备份，不在主读写路径上 |
| **图表** | 自定义 Canvas 2D 绘图 | 饼图/柱状图逻辑简单，自研成本可控 |
| **状态管理** | 页面 data + App 全局数据 + EventChannel | 无需 Redux/MobX，小程序原生能力足够 |
| **构建工具** | 微信开发者工具 | 官方支持，开箱即用 |

---

## 三、项目目录结构

```
miniprogram/
├── app.js                    # 应用入口：初始化 Storage、云同步、去重
├── app.json                  # 全局配置：页面路由（16个）、TabBar（5项）、Vant 组件
├── app.wxss                  # 全局样式：引入 CSS 变量、工具类
├── sitemap.json
│
├── pages/
│   ├── dashboard/            # 概览
│   ├── customer/             # 客户列表（视图 Chip 替代原 filter-bar）
│   ├── customer-detail/      # 客户详情（5 Tab：画像/沟通/异议/需求/计划）
│   ├── calendar/             # 日历看板（周/月视图）
│   ├── record/               # 拜访记录列表
│   ├── record-new/           # 新建拜访记录
│   ├── visit-record/detail/  # 拜访记录详情
│   ├── plan-select/          # 添加计划-客户选择
│   ├── objection/            # 异议池列表
│   ├── objection/select/     # 异议批量选择（从拜访记录页进入）
│   ├── objection-new/        # 新建异议（4 步流程）
│   ├── objection-detail/     # 异议详情
│   ├── segment-edit/         # 客户视图编辑器（规则配置 + 实时预览）
│   ├── policy-edit/          # 他渠道保单录入/编辑
│   ├── review/               # 复盘
│   └── rhythm/               # 节奏分析
│
├── components/
│   ├── customer-card/        # 客户卡片
│   ├── record-card/          # 拜访记录卡片
│   ├── objection-card/       # 异议卡片
│   ├── chart-pie/            # Canvas 2D 饼图
│   ├── chart-bar/            # Canvas 2D 柱状图
│   ├── metric-card/          # 指标卡片
│   ├── search-bar/           # 搜索栏
│   ├── form-field/           # 表单字段（label + 各类输入控件）
│   ├── tag-selector/         # 标签选择器（多选 Chip）
│   ├── inline-picker/        # 内联下拉选择
│   ├── step-indicator/       # 步骤指示器
│   ├── fab-button/           # FAB 浮动按钮
│   ├── empty-state/          # 空状态
│   └── skeleton/             # 骨架屏
│
├── utils/
│   ├── storage.js            # Storage 封装（事务 + 容量预警 + CloudSync 钩子）
│   ├── cloud-sync.js         # 云端备份/恢复（本地优先，防抖 3s 上传）
│   ├── dedup-records.js      # 一次性去重（启动时执行，meta 守卫防重复）
│   ├── repository/           # 数据访问层（唯一可操作 storage 的层）
│   │   ├── customer.repo.js
│   │   ├── plan.repo.js
│   │   ├── record.repo.js
│   │   ├── objection.repo.js
│   │   ├── policy.repo.js    # v1.1+，v1.3 扩展双轴时间模型
│   │   ├── segment.repo.js   # v1.1+
│   │   └── log.repo.js
│   ├── priority.js           # P0–P3 优先级评分引擎
│   ├── segment.js            # 视图规则引擎（内存过滤，支持嵌套 OR 子组）
│   ├── stats.js              # Dashboard 统计快照
│   ├── review-stats.js       # 复盘统计
│   ├── rhythm.js             # 节奏分析
│   ├── insight.js            # AI 洞察文字（规则模板生成）
│   ├── policy-templates.js   # 险种模板配置与格式化（纯函数）
│   ├── policy-compute.js     # 保单派生字段计算（到期日、下次缴费日等，纯函数）
│   ├── apple-rank.js         # 苹果分级算法（纯函数）
│   ├── date.js               # 日期工具
│   ├── id.js                 # 自增主键生成器
│   ├── constants.js          # 全局枚举常量（STAGE_CLASS_MAP 等）
│   ├── validators.js         # 表单校验
│   ├── toast.js              # Toast 封装
│   ├── chart.js              # Canvas 图表绘制工具
│   ├── objection-preset.js   # 预置异议库（不入 storage）
│   └── seed.js               # 开发种子数据
│
├── cloudfunctions/
│   └── login/                # 获取 openid（云同步初始化用）
│
└── styles/
    └── variables.wxss        # UI_SPEC CSS 变量（所有颜色/间距/圆角的唯一来源）
```

---

## 四、数据架构

### 4.1 存储模型总览

所有业务表数据以 JSON 数组形式存入 Storage，每张"表"一个 key：

| Storage Key | 对应实体 | 说明 |
|-------------|---------|------|
| `db_customer` | Customer | 客户信息 |
| `db_visit_record` | VisitRecord | 拜访记录 |
| `db_plan` | Plan | 拜访计划 |
| `db_objection` | Objection | 用户自建异议 |
| `db_objection_note` | ObjectionNote | 异议追加备注 |
| `db_objection_links` | ObjectionLink | 预置异议引用计数 |
| `db_operation_log` | OperationLog | 字段变更日志 |
| `db_policy` | Policy | 保单（v1.1+） |
| `db_segment` | Segment | 客户视图（v1.1+） |
| `db_meta` | — | `{ nextId, version, segment_index, derived_cache, dedup_v1_done, dedup_objection_v1_done }` |

详细字段定义见 [DATA_RELATIONSHIP.md](DATA_RELATIONSHIP.md)。

### 4.2 索引策略

Storage 无原生索引，采用**全量加载 + 内存过滤/排序**：

```javascript
// 示例：按视图规则过滤 + 派生字段排序
var enriched = policyRepo.getDerivedAll(customers);
return segment.applySegment(enriched, activeSeg.rules, activeSeg.sort);
```

预估数据规模（客户 <500、记录 <5000、异议 <200）下，单次全量加载 + 过滤均在 10ms 内。

### 4.3 事务策略

`storage.transaction(fn)` 实现快照 + 失败回滚：

```javascript
storage.transaction(() => {
  const records = storage.getTable('visit_record');
  const customers = storage.getTable('customer');
  const plans = storage.getTable('plan');
  const policies = storage.getTable('policy');
  // 修改内存对象...
  storage.setTable('visit_record', records);
  storage.setTable('customer', customers);
  storage.setTable('plan', plans);
  storage.setTable('policy', policies);
  // 任一 setTable 失败则用快照回滚所有已写入的表
});
```

### 4.4 自增 ID 生成

```javascript
// utils/id.js
nextId('customer')  // 从 db_meta.nextId.customer 读取，+1 写回，返回新值
```

单线程同步调用，无并发问题。

### 4.5 数据初始化流程

```
app.js onLaunch
  ├── cloudSync.init()               # 并行初始化云同步（失败不阻塞主流程）
  └── storage.init()
        ├── 检查 db_meta 是否存在
        │     ├── 不存在 → 初始化 db_meta、各空表
        │     └── 存在   → 检查 version，执行迁移（version < 2 → migrate_v2）
        ├── setCloudSync(cloudSync)  # 注册云同步钩子
        └── 设置 dbReady = true，resolve waitReady Promise
  └── 执行一次性去重（dedup_v1_done / dedup_objection_v1_done 守卫）
```

### 4.6 Storage API 契约

```javascript
// utils/storage.js 对外接口（Repository 层唯一依赖）
storage.init()
storage.waitReady()              // 返回 Promise
storage.getTable(name)           // 返回数组（深拷贝）
storage.setTable(name, data)     // 整表写回，触发 CloudSync dirty 标记
storage.transaction(fn)          // 事务执行，失败回滚
storage.getMeta()                // 直接返回 meta 引用（修改后需 persistMeta）
storage.persistMeta()            // 将 meta 写回 Storage
storage.setCloudSync(sync)       // 注入云同步对象
```

---

## 五、云同步架构（v1.3 新增）

### 5.1 整体架构

```
本地 storage.setTable()
  └── 触发 cloudSync.markDirty(tableName, data)
        └── 防抖 3s → cloudSync.upload(tableName, data) → 云数据库 table_backup
```

**失败重试**：App `onHide` / `onShow` 时调用 `cloudSync.flushDirty()`，遍历所有 dirty 表重新上传。

**数据恢复**：App 启动时，若本地数据为空，从云端 `table_backup` 拉取全量数据写入本地 Storage。

### 5.2 云开发资源

| 资源 | 说明 |
|------|------|
| 环境 ID | `pro-d1g97lgrm3a7cf83a` |
| 集合 | `table_backup`，文档结构：`{ _openid, table_name, data, updated_at }` |
| 云函数 | `login`，返回当前用户 openid |

---

## 六、核心算法设计

### 6.1 苹果分级（`utils/apple-rank.js`）

基于 `has_need / has_ability / is_decider` 三项判断：
- 全部为「是」→ `red`（红苹果）
- 两项为「是」→ `green`（青苹果）
- 不足两项为「是」→ `rotten`（烂苹果）
- 任一项为「不确定」→ `pending`（待定）

### 6.2 客户优先级（`utils/priority.js`）

`score = I（意向度）+ U（紧迫度）+ R（活跃度）`，满分 100。

| 组成 | 满分 | 主要规则 |
|------|------|---------|
| 意向度 I | 40 | 待促成=40、方案讲解=30、需求沟通=20、初步认识=10 |
| 紧迫度 U | 35 | 逾期 3 天+=35、今天=25、明天=18 |
| 活跃度 R | 25 | 3 天内=25、7 天内=18、14 天内=10 |

优先级映射：P0 ≥ 80 / P1 ≥ 60 / P2 ≥ 35 / P3 < 35。已成交/已流失不参与评分。

### 6.3 视图规则引擎（`utils/segment.js`）

支持嵌套 AND/OR 组合：

```javascript
// 规则示例（JSON 存入 segment.rules）
{
  "version": 1,
  "match": "AND",
  "rules": [
    { "field": "total_premium", "op": "gte", "value": 50000 },
    { "match": "OR", "rules": [
      { "field": "policy_count", "op": "gte", "value": 2 },
      { "field": "is_hnw", "op": "eq", "value": true }
    ]}
  ]
}
```

支持的操作符：`eq / neq / gt / gte / lt / lte / in / nin / exists`。  
`field` 支持 `coverage_status.养老` 等点分路径，以及 `total_premium`、`policy_count` 等派生字段（需先通过 `policyRepo.getDerivedAll()` 富化客户列表）。

### 6.4 保单模板与计算（`policy-templates.js` + `policy-compute.js`）

`policy-templates.js`：纯配置，7 种险种的默认 `coverage_term` / `payment_term`，以及 `product_type`（中文）↔ `category`（英文）双向映射。

`policy-compute.js`：纯函数，根据 `effective_date + coverage_term / payment_term` 计算：
- `computeExpiryDate()`：到期日（`to_age` 类型因无出生年无法推导，返回 null）
- `computeNextPaymentDate()`：下次缴费周年日
- `computePaymentEndDate()`：缴费结束日

### 6.5 节奏分析（`utils/rhythm.js`）

| 类型 | 判断规则 |
|------|---------|
| 升温中 | 最近 14 天拜访 ≥ 2 次，且近期频率 / 基线频率 ≥ 1.5× |
| 降温中 | 距上次拜访 ≥ 14 天，或近期频率 / 基线频率 ≤ 0.5× |
| 卡住了 | 在当前阶段停留超过阈值（初步认识/需求沟通 21 天，方案讲解 14 天，待促成 7 天） |

---

## 七、状态管理设计

### 7.1 全局状态（`app.js`）

```javascript
App({
  globalData: {
    storageReady: false,
    currentPeriod: 'week',
  },
  async onLaunch() {
    await storage.init();
    this.globalData.storageReady = true;
  }
});
```

### 7.2 页面间通信

| 场景 | 方案 |
|------|------|
| 计划卡片「执行」→ 新建记录 | `navigateTo` + `EventChannel` 传递 plan 对象 |
| 新建记录提交成功 → 刷新列表 | `onShow` 重载（简单场景） |
| 异议选择 → 回传选中列表 | `EventChannel.emit('selected', ids)` |
| 客户详情编辑 → 列表更新 | 返回触发 `onShow`，重新 loadData |

### 7.3 存储访问规范

- 页面 js **不得直接调用** `wx.getStorageSync/setStorageSync`
- 所有读写走 `utils/repository/*.repo.js`
- Repository 层底层依赖 `utils/storage.js`
- 页面 `onLoad` / `onShow` 开头统一 `await storage.waitReady()`

---

## 八、页面路由设计

### 8.1 TabBar（5 个主入口）

```json
[
  { "pagePath": "pages/dashboard/index",  "text": "概览" },
  { "pagePath": "pages/customer/index",   "text": "客户" },
  { "pagePath": "pages/calendar/index",   "text": "日历" },
  { "pagePath": "pages/rhythm/index",     "text": "节奏" },
  { "pagePath": "pages/review/index",     "text": "复盘" }
]
```

### 8.2 非 Tab 子页面

| 页面路径 | 入口 | 功能 |
|---------|------|------|
| `pages/customer-detail/index?id=N` | 客户卡片点击 | 客户详情 5 Tab |
| `pages/plan-select/index?date=DATE` | 客户详情计划 Tab | 选择客户添加计划 |
| `pages/record-new/index?customer_id=N&plan_id=M` | 计划执行 / FAB | 新建拜访记录 |
| `pages/visit-record/detail/index?id=N` | 日历/记录列表点击 | 拜访记录详情 |
| `pages/objection/index` | 新建记录 / 客户详情 | 异议池 |
| `pages/objection/select/index` | 新建记录选择异议 | 批量选择关联异议 |
| `pages/objection-new/index?step=0` | 异议池 FAB | 新建异议 4 步流程 |
| `pages/objection-detail/index?id=N` | 异议卡片 | 异议详情 |
| `pages/segment-edit/index?id=N` | 客户列表视图管理 | 视图规则编辑 |
| `pages/policy-edit/index?customer_id=N` | 客户详情需求 Tab | 他渠道保单录入 |

---

## 九、关键交互实现方案

### 9.1 新建拜访记录事务（成交场景）

```
record-new onSave()
  └── storage.transaction()
        ├── 插入 visit_record
        ├── 更新 customer.last_visit / visit_count
        ├── 若 comm_result='deal' → 更新 customer.stage='已成交'
        ├── 若有 plan_id → 更新 plan.status='已完成'
        └── 若 comm_result='deal' → 为每个 deal_products 创建 policy(source='self')
                                  → 更新 customer.coverage_status[险种]='configured'
```

### 9.2 客户列表视图切换

```
customer/index onShow()
  ├── customerRepo.list() → 全量客户
  ├── policyRepo.getDerivedAll(customers) → 富化派生字段
  ├── segmentRepo.listAll() → 全部视图定义
  ├── 对每个视图调用 segment.applySegment() → 计算命中数 segmentCounts
  └── 当前选中视图 → segment.applySegment(enriched, rules, sort) → 渲染列表
```

### 9.3 保单派生字段（`policyRepo.listWithComputed()`）

每条保单附加以下 `_` 前缀派生字段（不持久化，仅用于展示）：

| 字段 | 说明 |
|------|------|
| `_category` | 归一化 category（兼容旧 product_type） |
| `_coverage_term` | 归一化 coverage_term |
| `_payment_term` | 归一化 payment_term |
| `_payment_end_date` | 缴费结束日（policy-compute.js 推导） |
| `_card_status` | 展示状态（缴费中/已缴清/终身等） |
| `_policy_year` | 保单年度（距生效的年数） |
| `_policy_summary` | 保障/缴费期摘要文字 |
| `_needs_completion` | 是否需要补全信息 |

---

## 十、样式架构

### 10.1 全局样式分层

```
styles/variables.wxss    → 唯一 CSS 变量来源（颜色/间距/圆角）
app.wxss                 → @import variables + 全局工具类（.card .flex .text-primary 等）
各页面/组件 .wxss        → 仅引用变量，禁止写死色值
```

### 10.2 关键 CSS 变量分类

| 类别 | 前缀 | 示例 |
|------|------|------|
| 颜色-主题 | `--color-primary` | 品牌色、次要色、背景色 |
| 颜色-文字 | `--color-text-*` | primary / secondary / tertiary / disabled |
| 颜色-功能 | `--color-success/warning/danger` | 状态色 |
| 颜色-优先级 | `--priority-p0/p1/p2/p3-*` | 优先级标签背景、文字色 |
| 颜色-阶段 | `--stage-meet/comm/present/closing/deal/lost-*` | 阶段标签边框、文字色 |
| 间距 | `--spacing-*` | xs / sm / md / lg / xl |
| 圆角 | `--radius-*` | card / badge / button |

---

## 十一、平台限制应对

| 限制 | 应对策略 |
|------|---------|
| Storage 单 key 1MB / 总 10MB | 内置 800KB warn / 950KB critical 预警；云同步作为溢出安全网 |
| WXML 不支持复杂 JS 表达式 | JS 层预计算布尔/映射字段，WXML 只做简单绑定 |
| `setData` 丢弃 `_` 前缀属性 | 运行时标记用页面实例属性（`this._flag`），不经过 setData |
| `dataset` 将 id 转为字符串 | 读取后手动 `parseInt` 还原类型 |
| `navigateTo` 层级上限 10 | 深层页面使用 `redirectTo`，避免深层跳转链 |
| Canvas 2D 需 dpr 适配 | 参照 `chart-pie/index.js` 的 `dpr + scale` 模式 |
| `onLoad` options 均为字符串 | id 存在性判断用 `options.id !== undefined && options.id !== ''` |

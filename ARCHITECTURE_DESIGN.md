# 保险代理人活动管理小程序 — 开发架构设计 v1.2

> 基于 PRD v1.1 + UI_SPEC v1.0 + rules.md 约束
> 设计日期：2026-04-23
> 设计角色：Dev 💻

---

## 一、架构设计原则

| 原则 | 说明 |
|------|------|
| **Simplicity First** | 最小代码解决问题，不引入未请求的抽象和配置 |
| **本地优先** | 所有数据本地存储（wx.getStorageSync），零后端依赖 |
| **组件复用** | 高频 UI 模式抽取为组件，避免重复实现 |
| **可测试** | 核心业务逻辑（苹果分级、统计计算）独立为纯函数，便于单元测试 |
| **分层解耦** | Repository 层屏蔽存储细节，未来可平滑切换到 IndexedDB 或后端 |

---

## 二、技术选型

| 层级 | 技术方案 | 选型理由 |
|------|---------|---------|
| **框架** | 微信小程序原生开发 | PRD 无跨平台需求，原生开发 bundle 最小、调试最直接 |
| **UI 语言** | WXML + WXSS | 原生方案，与 UI_SPEC 的 CSS 变量体系直接对应 |
| **本地存储** | `wx.getStorageSync` + JSON 序列化 | 微信开发者工具不支持 WebAssembly，sql.js 无法调试；改用原生存储 API，零依赖、零兼容性问题；数据量（预估 <500 客户）完全在 Storage 限制内（单 key 1MB / 总量 10MB） |
| **图表** | 自定义 Canvas 2D 绘图 | 饼图/柱状图逻辑简单，自研成本可控；避免第三方图表库引入包体积压力 |
| **图标** | 微信小程序内置图标 + 少量自定义 SVG | UI_SPEC 要求线性图标，内置图标足够覆盖 Tab 栏和基础场景 |
| **状态管理** | 页面 data + App 全局数据 + EventChannel | 无需 Redux/MobX,小程序原生能力足够（Simplicity First） |
| **构建工具** | 微信开发者工具 | 官方支持，开箱即用 |

---

## 三、项目目录结构

```
miniprogram/
├── app.js                    # 应用入口：初始化 Storage、全局状态
├── app.json                  # 全局配置：页面路由、TabBar、导航栏
├── app.wxss                  # 全局样式：引入 CSS 变量、工具类
├── sitemap.json              # 搜索配置
│
├── pages/                    # 页面
│   ├── dashboard/            # 数据概览
│   ├── customer/             # 客户列表
│   ├── customer-detail/      # 客户详情（整页编辑）
│   ├── plan/                 # 拜访计划
│   ├── plan-select/          # 添加计划-客户选择
│   ├── record/               # 拜访记录列表
│   ├── record-new/           # 新建拜访记录
│   └── objection/            # 异议池
│
├── components/               # 可复用组件
│   ├── customer-card/
│   ├── plan-card/
│   ├── record-card/
│   ├── objection-card/
│   ├── apple-badge/
│   ├── stage-badge/
│   ├── chart-pie/            # Canvas 2D
│   ├── chart-bar/            # Canvas 2D
│   ├── week-calendar/
│   ├── filter-bar/
│   ├── fab-button/
│   ├── step-indicator/
│   ├── form-field/
│   ├── tag-selector/
│   ├── search-bar/
│   ├── metric-card/
│   ├── empty-state/
│   └── skeleton/
│
├── utils/                    # 工具函数
│   ├── storage.js            # 存储底层封装：init、getTable、setTable、transaction、waitReady
│   ├── id.js                 # 自增主键生成器（替代 SQL AUTOINCREMENT）
│   ├── repository/           # 业务 CRUD 层（接口稳定，底层可替换）
│   │   ├── customer.repo.js
│   │   ├── plan.repo.js
│   │   ├── record.repo.js
│   │   ├── objection.repo.js
│   │   └── log.repo.js
│   ├── constants.js          # 枚举值、配置项
│   ├── apple-rank.js         # 苹果分级算法（纯函数）
│   ├── stats.js              # 统计计算
│   ├── validators.js         # 表单校验
│   ├── date.js               # 日期工具
│   └── toast.js              # 轻提示封装
│
├── styles/
│   └── variables.wxss        # UI_SPEC CSS 变量
│
└── images/                   # 静态资源
    ├── icons/
    └── apple/
```

---

## 四、数据架构（wx.getStorageSync + JSON）

### 4.1 存储模型总览

所有业务表数据以 JSON 数组形式存入 Storage，每张"表"一个 key：

| Storage Key | 对应实体 | 数据结构 |
|------|------|------|
| `db_customer` | 客户 | `Customer[]` |
| `db_visit_record` | 拜访记录 | `VisitRecord[]` |
| `db_plan` | 拜访计划 | `Plan[]` |
| `db_objection` | 异议 | `Objection[]` |
| `db_objection_note` | 异议追加备注 | `ObjectionNote[]` |
| `db_operation_log` | 操作日志 | `OperationLog[]` |
| `db_meta` | 元数据（id 池、版本号） | `{ nextId: {...}, version: 1 }` |

### 4.2 实体字段结构

#### Customer

| 字段名 | 类型 | 默认值 | 说明 |
|--------|------|------|------|
| `id` | number | - | 自增主键，由 id.js 生成 |
| `name` | string | - | 业务唯一，写入前查重 |
| `gender` | string | `''` | 男/女 |
| `relation` | string | `''` | 同事/朋友/亲戚/其他 |
| `income` | string | `''` | 收入范围 |
| `age_range` | string | `''` | 年龄段 |
| `occupation` | string | `''` | 职业 |
| `house_type` | string | `''` | 居住类型 |
| `marriage` | string | `''` | 婚姻状况 |
| `friendship` | string | `''` | 交情程度 |
| `stage` | string | `'需求沟通'` | 需求沟通/已拒绝/已成交 |
| `stage_updated_at` | string\|null | `null` | ISO 时间字符串，stage 变更时写入 |
| `follow_date` | string\|null | `null` | 跟进时间 |
| `todo_task` | string | `''` | 代办任务 |
| `objection_legacy` | string | `''` | 飞书遗留异议字段 |
| `apple_rank` | string | `'待定'` | 红苹果/青苹果/烂苹果/待定 |
| `apple_rank_overridden` | 0\|1 | `0` | 是否手动覆盖 |
| `has_need` | string | `'不确定'` | 是/否/不确定 |
| `has_budget` | string | `'不确定'` | 是/否/不确定 |
| `is_decider` | string | `'不确定'` | 是/否/不确定 |
| `family` | string[] | `[]` | 家庭成员数组 |
| `coverage` | string[] | `[]` | 已有保障数组 |
| `gap` | string[] | `[]` | 保障缺口数组 |
| `last_visit` | string\|null | `null` | 最近拜访日期（自动写入） |
| `visit_count` | number | `0` | 累计拜访次数（自动累加） |
| `created_at` | string | 当前 ISO | 创建时间 |
| `updated_at` | string | 当前 ISO | 更新时间 |

#### VisitRecord

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `id` | number | 主键 |
| `customer_id` | number | 关联客户 |
| `plan_id` | number\|null | 关联计划（可空） |
| `visit_date` | string | 拜访日期 |
| `visit_way` | string | 面对面/电话/微信 |
| `duration` | number\|null | 时长（分钟） |
| `summary` | string | 沟通摘要（必填） |
| `updated_fields` | string[] | 本次更新的客户字段 |
| `is_deal` | string | 签单成交/暂未成交 |
| `next_follow_date` | string\|null | 下次跟进日期 |
| `has_objection` | 0\|1 | 是否关联异议 |
| `created_at` | string | 创建时间 |

#### Plan

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `id` | number | 主键 |
| `customer_id` | number | 关联客户 |
| `plan_date` | string | 计划日期 |
| `visit_way` | string | 拜访方式 |
| `status` | string | `'待执行'` / `'已完成'` |
| `created_at` | string | 创建时间 |

> **无唯一约束：​** 同一客户同一天可多次添加（不同拜访方式）；业务层检测同日冲突并弹窗提示。

#### Objection

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `id` | number | 主键 |
| `customer_id` | number | 关联客户（首次创建时） |
| `content` | string | 异议原话 |
| `category` | string | 价格/必要性/时机/产品对比/信任/其他 |
| `solution` | string | 应对话术 |
| `count` | number | 出现次数，追加时 +1 |
| `created_at` | string | 创建时间 |

#### ObjectionNote（异议追加备注）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `id` | number | 主键 |
| `objection_id` | number | 关联异议 |
| `customer_id` | number | 本次追加关联的客户 |
| `note` | string | 追加的具体备注内容 |
| `created_at` | string | 追加时间 |

#### OperationLog

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `id` | number | 主键 |
| `customer_id` | number | 关联客户 |
| `field` | string | 修改字段 |
| `old_value` | string | 旧值 |
| `new_value` | string | 新值 |
| `created_at` | string | 时间 |

### 4.3 索引策略

Storage 无原生索引，采用**全量加载 + 内存过滤/排序**：

```javascript
// 示例：按苹果等级筛选 + 按最近拜访排序
const all = storage.getTable('customer');
return all
  .filter(c => c.apple_rank === '红苹果')
  .sort((a, b) => (b.last_visit || '').localeCompare(a.last_visit || ''));
```

预估数据规模（客户 <500、记录 <5000、异议 <200）下，单次全量加载 + 过滤均在 5ms 内。

### 4.4 事务策略

Storage 无原生事务，采用**快照 + 失败回滚**机制：

```javascript
storage.transaction(() => {
  const customers = storage.getTable('customer');
  const records = storage.getTable('visit_record');
  // ... 修改内存对象
  storage.setTable('customer', customers);
  storage.setTable('visit_record', records);
});
```

`transaction()` 内部实现：开始时对涉及表做快照，任一步抛异常时用快照回滚所有已写入的表。

### 4.5 自增 id 生成

```javascript
// utils/id.js
nextId('customer')  // 从 db_meta.nextId.customer 读取，+1 写回，返回新值
```

单线程同步调用，无并发问题。

### 4.6 数据初始化流程

```
app.js onLaunch
  └── storage.init()
        ├── 检查 db_meta 是否存在
        │     ├── 不存在 → 初始化 db_meta、各空表
        │     └── 存在   → 检查 version，执行迁移（预留）
        └── 设置 dbReady = true，resolve waitReady Promise
```

### 4.7 Storage API 契约

```javascript
// utils/storage.js 对外接口（Repository 层唯一依赖）
storage.init()
storage.waitReady()              // 返回 Promise
storage.getTable(name)           // 返回数组（深拷贝）
storage.setTable(name, data)     // 整表写回
storage.transaction(fn)          // 事务执行
```

Repository 层接口稳定：

```javascript
customerRepo.list(filters)
customerRepo.get(id)
customerRepo.create(data)
customerRepo.update(id, data)
customerRepo.delete(id)
```

---

## 五、核心算法设计

### 5.1 苹果分级算法（`utils/apple-rank.js`）

```javascript
function calculateAppleRank(dimensions) {
  const { has_need, has_budget, is_decider } = dimensions;

  if (has_need === '不确定' || has_budget === '不确定' || is_decider === '不确定') {
    return '待定';
  }

  const yesCount = [has_need, has_budget, is_decider].filter(v => v === '是').length;
  if (yesCount === 3) return '红苹果';
  if (yesCount === 2) return '青苹果';
  return '烂苹果';
}

function canAutoRank(customer) {
  return customer.has_need !== '不确定'
    && customer.has_budget !== '不确定'
    && customer.is_decider !== '不确定';
}
```

### 5.2 Dashboard 统计（`utils/stats.js`）

```javascript
function getStatsSnapshot() {
  return {
    customers: storage.getTable('customer'),
    plans: storage.getTable('plan'),
    records: storage.getTable('visit_record'),
    objections: storage.getTable('objection'),
  };
}

function getDashboardMetrics(period, anchorDate = new Date()) {
  const { customers, records } = getStatsSnapshot();
  const [start, end] = period === 'week'
    ? getWeekRange(anchorDate)
    : getMonthRange(anchorDate);

  return {
    totalCustomers: customers.length,
    newCustomers: customers.filter(c => c.created_at >= start && c.created_at <= end).length,
    visitCount: records.filter(r => r.visit_date >= start && r.visit_date <= end).length,
    dealCount: customers.filter(c =>
      c.stage === '已成交' &&
      c.stage_updated_at &&
      c.stage_updated_at >= start &&
      c.stage_updated_at <= end
    ).length
  };
}

function getAppleDistribution() {
  const groups = {};
  storage.getTable('customer').forEach(c => {
    groups[c.apple_rank] = (groups[c.apple_rank] || 0) + 1;
  });
  return Object.entries(groups).map(([name, value]) => ({ name, value }));
}

function getObjectionDistribution() {
  const groups = {};
  storage.getTable('objection').forEach(o => {
    groups[o.category] = (groups[o.category] || 0) + o.count;
  });
  return Object.entries(groups).map(([name, value]) => ({ name, value }));
}

function getVisitTrend(anchorDate) {
  // 遍历周一至周日，分别统计 plan 和 visit_record
  // 返回 [{date, planCount, visitCount}, ...]
}
```

---

## 六、状态管理设计

### 6.1 全局状态（`app.js`）

```javascript
App({
  globalData: {
    storageReady: false,
    currentPeriod: 'week',
    filters: { appleRank: '全部', stage: '全部' }
  },

  async onLaunch() {
    await storage.init();
    this.globalData.storageReady = true;
  }
});
```

### 6.2 页面间通信

| 场景 | 方案 |
|------|------|
| 计划卡片「执行」→ 新建记录 | `wx.navigateTo` + `EventChannel` 传递 plan 对象 |
| 新建记录提交成功 → 刷新列表 | `getCurrentPages()` 回调或 `onShow` 重载 |
| 客户详情编辑 → 列表更新 | 返回上一页携带 `refresh=true` |

### 6.3 存储访问规范

- 页面 js **不得直接调用** `wx.getStorageSync/setStorageSync`
- 所有读写走 `utils/repository/*.repo.js`
- Repository 层底层依赖 `utils/storage.js`
- 页面 `onLoad` / `onShow` 开头统一 `await storage.waitReady()`

---

## 七、页面路由设计

### 7.1 TabBar 页面（4 个主入口）

```json
{
  "tabBar": {
    "list": [
      { "pagePath": "pages/dashboard/index", "text": "概览" },
      { "pagePath": "pages/customer/index", "text": "客户" },
      { "pagePath": "pages/plan/index", "text": "计划" },
      { "pagePath": "pages/record/index", "text": "记录" }
    ]
  }
}
```

> 异议池作为记录页内入口或独立页面（非 Tab）。

### 7.2 非 Tab 子页面

| 页面路径 | 入口 | 功能 |
|---------|------|------|
| `pages/customer-detail/index?id=123` | 客户卡片点击 | 客户详情 + 整页编辑 |
| `pages/plan-select/index?date=2026-04-23` | 计划页「添加」按钮 | 选择客户添加计划 |
| `pages/record-new/index?customer_id=1&plan_id=2` | 计划卡片「执行」/ 记录页 FAB | 新建拜访记录 |
| `pages/objection/index` | 记录页入口 / 新建异议跳转 | 异议池列表 + 新建 |

---

## 八、组件拆分详单

### 8.1 业务组件

| 组件 | 复用位置 | Props |
|------|---------|-------|
| `customer-card` | 客户列表、计划选择、记录列表 | `customer`, `showStage` |
| `plan-card` | 计划页列表 | `plan`, `onExecute`, `onDelete` |
| `record-card` | 记录列表 | `record` |
| `objection-card` | 异议池列表 | `objection` |

### 8.2 纯 UI 组件

| 组件 | 复用位置 | Props |
|------|---------|-------|
| `apple-badge` | 客户卡片、详情页 | `rank` |
| `stage-badge` | 客户卡片、详情页 | `stage` |
| `metric-card` | Dashboard 2×2 网格 | `value`, `label` |
| `chart-pie` | Dashboard 苹果分布 | `data` |
| `chart-bar` | Dashboard 异议分布、拜访趋势 | `data`, `series` |
| `week-calendar` | 计划页 | `selectedDate`, `markedDates`, `onSelect` |
| `filter-bar` | 客户列表、计划选择 | `filters`, `onChange` |
| `fab-button` | 计划页、记录页 | `onTap` |
| `step-indicator` | 新建拜访记录 | `steps`, `current` |
| `tag-selector` | 新建记录、客户详情 | `options`, `value`, `onChange` |
| `form-field` | 客户详情编辑、新建记录 | `label`, `type`, `value` |
| `search-bar` | 客户列表 | `value`, `onSearch` |
| `empty-state` | 各列表页 | `icon`, `text`, `action` |
| `skeleton` | 各列表页 | `rows` |

---

## 九、关键交互实现方案

### 9.1 拜访计划「执行」→ 新建记录联动

```javascript
// plan-card.js
onExecute() {
  const { plan } = this.properties;
  wx.navigateTo({
    url: `/pages/record-new/index?customer_id=${plan.customer_id}&plan_id=${plan.id}&visit_way=${plan.visit_way}`,
    success: (res) => {
      res.eventChannel.emit('preloadPlan', { plan });
    }
  });
}
```

### 9.2 拜访记录提交事务

```javascript
// record.repo.js create()
storage.transaction(() => {
  const records = storage.getTable('visit_record');
  const customers = storage.getTable('customer');
  const plans = storage.getTable('plan');

  // 1. 插入拜访记录
  records.push({
    id: nextId('visit_record'),
    ...data,
    created_at: nowISO()
  });

  // 2. 更新客户最近拜访日期和累计次数
  const customer = customers.find(c => c.id === data.customer_id);
  customer.last_visit = data.visit_date;
  customer.visit_count += 1;
  customer.updated_at = nowISO();

  // 3. 若成交，更新跟进阶段 + 阶段变更时间
  if (data.is_deal === '签单成交') {
    customer.stage = '已成交';
    customer.stage_updated_at = nowISO();
  }

  // 4. 若由计划触发，更新计划状态
  if (data.plan_id) {
    const plan = plans.find(p => p.id === data.plan_id);
    if (plan) plan.status = '已完成';
  }

  storage.setTable('visit_record', records);
  storage.setTable('customer', customers);
  storage.setTable('plan', plans);
});
```

### 9.3 苹果分级实时计算

```javascript
// customer-detail/index.js
onDimensionChange(e) {
  const { field, value } = e.detail;
  this.setData({ [field]: value });

  const { has_need, has_budget, is_decider, apple_rank_overridden } = this.data;
  if (apple_rank_overridden) return;  // 已手动覆盖，不自动重算

  const autoRank = calculateAppleRank({ has_need, has_budget, is_decider });
  this.setData({ apple_rank: autoRank });
}

onAppleRankManualChange(e) {
  this.setData({
    apple_rank: e.detail.value,
    apple_rank_overridden: 1
  });
  // 保存时一并写入 Storage
}
```

---

## 十、样式架构

### 10.1 全局样式分层

```css
/* app.wxss */
@import "styles/variables.wxss";

.flex { display: flex; }
.flex-col { flex-direction: column; }
.items-center { align-items: center; }
.justify-between { justify-content: space-between; }
.text-primary { color: var(--color-text-primary); }
.text-secondary { color: var(--color-text-secondary); }
.bg-page { background-color: var(--color-bg-page); }
.card {
  background: var(--color-bg-card);
  border-radius:


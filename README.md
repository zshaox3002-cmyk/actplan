# ActPlan — 保险代理人活动管理小程序

面向保险代理人的日常活动管理工具，微信小程序原生开发，零后端依赖，数据全部存储在微信本地 Storage。

## 功能模块

### 行动面板（Dashboard）
- 今日待执行计划列表，逾期计划高亮提醒
- 周期切换（本周 / 本月 / 季度 / 年度）的进展指标：新增客户、拜访次数、预约次数、成交客户
- 客户阶段漏斗（初步认识 → 需求沟通 → 方案讲解 → 待促成 → 已成交）
- 待跟进客户 Top 列表

### 客户管理
- 客户跟进池，按 P0–P3 动态优先级排序
  - 优先级由意向度（阶段）+ 紧迫度（下次计划距今）+ 活跃度（最近拜访距今）三维评分决定
- 支持优先级、阶段多维筛选与关键词搜索
- 客户详情 5 Tab 工作台：画像 / 沟通记录 / 异议 / 需求 / 计划

### 日历看板
- 周视图 / 月视图切换，标记有计划或记录的日期
- 选中日期展示当日计划与拜访记录事件列表

### 拜访记录
- 单页平铺式表单，支持关联已有计划
- 保存时事务性写入：创建记录 → 更新客户最近拜访 → 标记计划已完成 → 可选创建下次跟进计划
- 支持在记录中关联异议

### 异议管理
- 预置异议库（价格 / 必要性 / 时机 / 产品对比 / 信任 / 其他）+ 用户自建异议
- 异议详情支持追加备注，自动统计出现次数
- 异议池支持分类筛选

### 复盘 & 节奏
- 复盘：按周期汇总拜访数据、阶段变化、成交情况
- 节奏：分析各客户跟进频率，识别跟进过密或断联风险

## 技术架构

```
miniprogram/
├── app.js / app.json / app.wxss
├── pages/                    # 14 个页面
│   ├── dashboard/            # 行动面板
│   ├── customer/             # 客户列表
│   ├── customer-detail/      # 客户详情（5 Tab）
│   ├── calendar/             # 日历看板
│   ├── record/               # 拜访记录列表
│   ├── record-new/           # 新建拜访记录
│   ├── visit-record/detail/  # 拜访记录详情
│   ├── plan-select/          # 计划客户选择
│   ├── objection/            # 异议池
│   ├── objection-new/        # 新建异议
│   ├── objection-detail/     # 异议详情
│   ├── review/               # 复盘
│   └── rhythm/               # 节奏分析
├── components/               # 16 个自定义组件
│   ├── customer-card/        # 客户卡片（优先级标签 + 阶段标签）
│   ├── record-card/          # 拜访记录卡片
│   ├── objection-card/       # 异议卡片
│   ├── chart-pie/            # Canvas 2D 饼图
│   ├── chart-bar/            # Canvas 2D 柱状图
│   ├── metric-card/          # 指标卡片
│   ├── filter-bar/           # 筛选栏
│   ├── search-bar/           # 搜索栏
│   ├── form-field/           # 表单字段
│   ├── tag-selector/         # 标签选择器
│   ├── inline-picker/        # 内联下拉选择
│   ├── step-indicator/       # 步骤指示器
│   ├── fab-button/           # FAB 浮动按钮
│   ├── empty-state/          # 空状态
│   └── skeleton/             # 骨架屏
└── utils/
    ├── storage.js            # Storage 封装（事务 + 容量预警）
    ├── repository/           # 数据访问层（唯一可操作 storage 的层）
    │   ├── customer.repo.js
    │   ├── plan.repo.js
    │   ├── record.repo.js
    │   ├── objection.repo.js
    │   └── log.repo.js
    ├── priority.js           # P0–P3 优先级评分引擎
    ├── stats.js              # Dashboard 统计快照
    ├── review-stats.js       # 复盘统计
    ├── rhythm.js             # 节奏分析
    ├── insight.js            # 洞察分析
    ├── date.js               # 日期工具
    ├── id.js                 # 自增主键生成器
    ├── constants.js          # 全局枚举常量
    ├── validators.js         # 表单校验
    ├── toast.js              # Toast 封装
    ├── chart.js              # 图表绘制工具
    ├── objection-preset.js   # 预置异议库
    └── seed.js               # 开发种子数据
```

## 数据存储

采用 `wx.getStorageSync` + JSON，共 7 张表：

| 表名 | Storage Key | 说明 |
|------|-------------|------|
| customer | db_customer | 客户信息 |
| visit_record | db_visit_record | 拜访记录 |
| plan | db_plan | 拜访计划 |
| objection | db_objection | 用户自建异议 |
| objection_note | db_objection_note | 异议追加备注 |
| objection_links | db_objection_links | 预置异议引用计数 |
| operation_log | db_operation_log | 客户字段变更日志 |

单个 key 上限 1MB，总计 10MB。storage.js 内置容量预警（800KB warn / 950KB critical），接近上限时弹窗提示导出。

详细字段定义和跨表关系见 [DATA_RELATIONSHIP.md](DATA_RELATIONSHIP.md)。

## 快速开始

**前置条件**：[微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html) + 微信小程序 AppID

```bash
git clone https://github.com/zshaox3002-cmyk/actplan.git
```

用微信开发者工具导入项目，选择 `miniprogram/` 目录，填入 AppID 即可运行。

**注入演示数据**（开发者工具控制台）：

```javascript
getApp().seedRun()
```

生成 6 个客户 + 计划 + 拜访记录 + 预置异议数据。注意：`seedRun` 默认在发布版本中已禁用，需在 `app.js` 中取消注释 seed 相关代码。

## 项目文档

| 文档 | 说明 |
|------|------|
| [DATA_RELATIONSHIP.md](DATA_RELATIONSHIP.md) | 数据表结构与跨表关系 |
| [ARCHITECTURE_DESIGN.md](ARCHITECTURE_DESIGN.md) | 架构设计文档 |
| [CLAUDE.md](CLAUDE.md) | 开发规范（AI 协作约束） |

## 许可证

[MIT](LICENSE)

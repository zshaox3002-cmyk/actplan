# ActPlan — 保险代理人活动管理小程序

> 友邦保险代理人日常活动管理工具，基于微信小程序的纯前端应用。

## 功能概览

| Tab | 功能 | 说明 |
|-----|------|------|
| 📊 概览 | Dashboard | 拜访统计、苹果分布饼图、异议分布、拜访趋势柱状图 |
| 👤 客户 | 客户管理 | 客户列表/筛选、客户详情（picker 表单）、苹果分级 |
| 📅 计划 | 拜访计划 | 周视图日历、添加计划、客户选择（排除已有计划） |
| 💬 异议 | 异议池 | 异议卡片列表、分类筛选、新建异议（4 步流程）、话术管理 |

### 核心特性

- **苹果分级系统** — 基于 3 维度（需求/购买力/决策权）自动分级（红/青/烂/待定）
- **拜访记录** — 单页平铺式表单，自动关联计划、同步客户阶段、自动创建跟进计划
- **异议处理话术** — 预置异议 + 用户自建异议，支持同类合并、追加备注
- **纯前端架构** — 零后端依赖，数据全部存储在微信本地 Storage

## 技术架构

```
miniprogram/
├── app.js / app.json / app.wxss    # 应用入口
├── pages/                           # 4 个主页面 + 5 个子页面
│   ├── dashboard/                   # 概览
│   ├── customer/                    # 客户列表
│   ├── customer-detail/             # 客户详情
│   ├── plan/                        # 拜访计划
│   ├── plan-select/                 # 添加计划客户选择
│   ├── record-new/                  # 新建拜访记录
│   ├── visit-record/detail/         # 拜访记录详情
│   ├── objection/                   # 异议池
│   ├── objection-new/               # 新建异议
│   └── objection-detail/            # 异议详情
├── components/                      # 17 个自定义组件
│   ├── customer-card/               # 客户卡片
│   ├── plan-card/                   # 计划卡片
│   ├── record-card/                 # 记录卡片
│   ├── objection-card/              # 异议卡片
│   ├── week-calendar/               # 周视图日历
│   ├── chart-pie/                   # Canvas 饼图
│   ├── chart-bar/                   # Canvas 柱状图
│   ├── metric-card/                 # 指标卡片
│   ├── form-field/                  # 表单字段
│   ├── tag-selector/                # 标签选择器
│   ├── inline-picker/               # 内联下拉选择
│   ├── step-indicator/              # 步骤指示器
│   ├── fab-button/                  # FAB 浮动按钮
│   ├── empty-state/                 # 空状态
│   └── skeleton/                    # 骨架屏
├── utils/                           # 工具层
│   ├── storage.js                   # Storage 底层封装（事务+容量检查）
│   ├── id.js                        # 自增主键生成器
│   ├── date.js                      # 日期工具
│   ├── constants.js                 # 常量定义
│   ├── apple-rank.js                # 苹果分级算法
│   ├── stats.js                     # Dashboard 统计纯函数
│   ├── chart.js                     # 通用图表绘制
│   ├── toast.js                     # 统一 Toast 封装
│   ├── validators.js                # 表单校验
│   ├── seed.js                      # 开发种子数据
│   └── repository/                  # 数据访问层
│       ├── customer.repo.js
│       ├── plan.repo.js
│       ├── record.repo.js
│       ├── objection.repo.js
│       └── log.repo.js
├── assets/icons/                    # SVG 图标
├── images/                          # 静态图片
└── styles/                          # 全局样式
```

### 数据存储

采用 `wx.getStorageSync` + JSON 方案，7 张表：

| 表名 | Storage Key | 说明 |
|------|------------|------|
| customer | db_customer | 客户信息 |
| visit_record | db_visit_record | 拜访记录 |
| plan | db_plan | 拜访计划 |
| objection | db_objection | 用户自建异议 |
| objection_note | db_objection_note | 异议追加备注 |
| objection_links | db_objection_links | 预置异议计数链接 |
| operation_log | db_operation_log | 操作日志 |

详细的数据关系表见 [DATA_RELATIONSHIP.md](DATA_RELATIONSHIP.md)。

## 快速开始

### 前置条件

- [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
- 微信小程序 AppID（在 [微信公众平台](https://mp.weixin.qq.com/) 注册）

### 安装步骤

```bash
# 1. 克隆仓库
git clone https://github.com/zshaox3002-cmyk/actplan.git
cd actplan

# 2. 用微信开发者工具导入项目
#    选择 miniprogram/ 目录作为项目根目录
#    填入你的 AppID
```

### 种子数据

首次运行时，可在微信开发者工具控制台执行：

```javascript
var seed = require('./utils/seed'); seed.run();
```

生成演示数据（6 个客户 + 6 条计划 + 6 条记录 + 预置异议）。

## 项目文档

| 文档 | 说明 |
|------|------|
| [UI_SPEC.md](UI_SPEC.md) | UI 设计规范 |
| [ARCHITECTURE_DESIGN.md](ARCHITECTURE_DESIGN.md) | 架构设计文档 |
| [DATA_RELATIONSHIP.md](DATA_RELATIONSHIP.md) | 数据关系表 |
| [rules.md](rules.md) | 开发规范与 AI 协作规则 |

## 技术栈

- **框架**：微信小程序原生开发
- **存储**：wx.getStorageSync / wx.setStorageSync + JSON
- **图表**：Canvas 2D 自绘（饼图/柱状图）
- **架构**：Repository 模式 + 事务支持

## 许可证

[MIT](LICENSE)

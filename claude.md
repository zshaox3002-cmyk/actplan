# 保险代理人活动管理小程序 — 开发规范

> 本文件为 Claude Code 在本项目的行为约束，每次新建会话时自动加载。
> 项目规则（一~八）优先；通用行为准则（附录）作为补充。

---

## 一、技术栈约束

| 规则 | 说明 |
|------|------|
| ✅ 使用 WXML / WXSS / 原生 JS | 微信小程序原生开发 |
| ❌ 禁止引入 React / Vue / TypeScript | 不使用任何前端框架或类型系统 |
| ❌ 禁止引入 npm 包管理 | 第三方库仅限手动放入 `lib/` 目录 |

---

## 二、样式规范

| 规则 | 说明 |
|------|------|
| ✅ 所有颜色、间距、圆角必须引用 `styles/variables.wxss` 里的 CSS 变量 | 如 `var(--color-primary)`、`var(--radius-card)` |
| ❌ 禁止在 WXSS 中写死色值、数值 | 如 `color: #1A6FD4` 或 `border-radius: 16px` 均不允许 |
| ✅ 全局工具类使用 `app.wxss` 中定义的 | 如 `.card`、`.flex`、`.text-primary` |
| ❌ 禁止使用 `!important` | 通过选择器优先级控制 |

### 排版层级规范

| 层级 | 用途 | 字号 | 字重 | 颜色 |
|------|------|------|------|------|
| 核心数据 | 指标数字（如 metric-value） | 40rpx | 600 | `var(--color-primary)` |
| 主标题 | Section 标题 | 30rpx | 500 | `var(--color-text-primary)` |
| 主信息 | 列表主行（客户名等） | 30rpx | 500 | `var(--color-text-primary)` |
| 次要信息 | 副标题、描述、meta | 24rpx | 400 | `var(--color-text-secondary)` |
| 辅助文字 | 问候语、提示语 | 26rpx | 400 | `var(--color-text-primary)` |

**原则：**
- ❌ 禁止在同一页面大量使用 weight 600/700，会导致视觉层次扁平
- ✅ 用颜色（`var(--color-primary)`）突出核心数据，而不是靠更粗的字重
- ✅ 主次信息的区分优先靠字号差，其次靠颜色，最后才靠字重

### 标签组件规范

项目中有四种标签形态，**不可混用**：

| 标签类型 | 形态 | padding | border-radius | font-size | 颜色方案 | Class 命名 |
|---------|------|---------|--------------|-----------|---------|-----------|
| **优先级标签** | 实心色块，白色文字 | `4rpx 14rpx` | `var(--radius-badge)` | `22rpx` | 背景用 `var(--priority-pX-text)` | `.priority-tag.priority-P0/P1/P2/P3` |
| **阶段标签** | 描边，无背景 | `4rpx 14rpx` | `var(--radius-badge)` | `22rpx` | 文字/边框用 `var(--stage-xxx-text)` | `.stage-tag.stage-meet/comm/present/closing/deal/lost` |
| **客户画像标签** | 浅蓝背景 | `4rpx 14rpx` | `var(--radius-badge)` | `22rpx` | `--color-secondary-light` + `--color-secondary` | `.custom-tag` |
| **筛选 Chip** | 胶囊形，激活时填色 | `10rpx 24rpx` | `32rpx`（刻意圆形） | `26rpx` | 激活用 `var(--color-primary)` | `.chip-item` |

**阶段 class 映射表**（JS 层转换，WXML 只做 class 绑定）：

```js
var STAGE_CLASS_MAP = {
  '初步认识': 'meet',
  '需求沟通': 'comm',
  '方案讲解': 'present',
  '待促成':   'closing',
  '已成交':   'deal',
  '已流失':   'lost'
};
```

**规则：**
- ✅ 阶段标签必须按阶段绑定对应颜色 class，不允许统一用灰色
- ✅ Chip 的 `32rpx` 圆角是刻意与内容标签（`6px`）区分的，不要统一
- ❌ 禁止在不同页面对同一语义标签使用不同样式（如 dashboard 的阶段标签必须与 customer-card 一致）

---

## 三、数据层规范

| 规则 | 说明 |
|------|------|
| ✅ 所有存储操作通过 `utils/repository/*` | Repository 层统一封装，禁止页面直接调用 storage |
| ❌ 禁止在页面 JS 里直接调用 `storage.getTable/setTable` | 仅 repo 层可直接操作 storage（已知例外：`visit-record/detail/index.js` 直接读 plan 表，应后续修正） |
| ✅ 事务操作使用 `storage.transaction()` | 拜访记录创建、异议备注追加等涉及多表更新的场景必须使用事务 |
| ✅ 页面 `onLoad`/`onShow` 开头调用 `storage.waitReady()` | 确保存储初始化完成（异步） |
| ✅ 修改数据结构前查阅 `DATA_RELATIONSHIP.md` | 确认影响面，同步更新关系表文档 |
| ✅ 运行时标记用页面实例属性，不放 `data` | 如 `this._justCreatedIds = []`（不经过 `setData`，不受序列化影响）；`data` 只放渲染相关数据 |
| ~~`record-new/index.js` 存在非事务多表写入~~ ✅ 已修复 | onSave() 外层已包 `storage.transaction()`，4 步操作原子化 |

---

## 四、业务逻辑规范

| 规则 | 说明 |
|------|------|
| ✅ 业务逻辑（苹果分级、统计计算等）写成纯函数 | 放在 `utils/` 下，如 `apple-rank.js`、`stats.js` |
| ✅ 纯函数不依赖外部状态，输入 → 输出 | 便于单元测试，如 `calculateAppleRank(dimensions)` |
| ❌ 禁止将业务逻辑混入页面 JS 或组件 JS | 页面只做数据绑定和事件转发 |

---

## 五、设计原则

| 原则 | 说明 |
|------|------|
| **Simplicity First** | 最小代码解决问题，不引入未请求的抽象和配置 |
| **不过度设计** | 不为"未来可能的需求"预留扩展点 |
| **不过度封装** | 单次使用的代码不抽象，不过早提取公共方法 |
| **Surgical Changes** | 只改必须改的，不顺手"优化"周边代码 |

---

## 六、代码质量

| 规则 | 说明 |
|------|------|
| ✅ 每个函数必须有 JSDoc 注释 | 说明参数、返回值、用途 |
| ✅ 表单提交前必须校验必填项 | 使用 `utils/validators.js` |
| ✅ 用户操作必须有即时反馈 | Toast 提示、加载态、成功/失败状态 |
| ✅ 自动写入字段在编辑态中置灰 | 不可操作，视觉上明显区分 |

---

## 七、微信小程序平台限制清单

> 修改或新增功能时，必须对照此清单自查。

| # | 限制 | 影响 | 应对策略 |
|---|------|------|---------|
| 1 | **Storage 单个 key 上限 1MB，总计 10MB** | 单表数据过大将写入失败 | storage.js 已内置容量预警（800KB warn / 950KB critical），大数据量需考虑分表或导出 |
| 2 | **`wx.setStorageSync` 同步写阻塞 JS 线程** | 大数据写入会卡顿 | 避免 `setTable` 写入超大数组；事务内多次 `setTable` 须精简 |
| 3 | **WXML 不支持复杂 JS 表达式** | `indexOf`、`find`、箭头函数等无法在 WXML 中使用 | 在 JS 层预计算（如 `isSelected` 布尔字段），WXML 只做简单属性访问 |
| 4 | **WXML `dataset` 将所有值转为字符串** | 数字 ID 经过 dataset 后变成字符串 | 读取 dataset 后手动 `parseInt` 还原类型 |
| 5 | **Canvas 2D 需手动 dpr 适配** | 不适配则 Canvas 模糊 | 参照 `chart-pie/index.js` 的 `dpr + scale` 模式 |
| 6 | **`wx.enableAlertBeforeUnload` 仅页面级生效** | 页面卸载时需逐页设置 | 进入编辑态即启用，保存/离开时禁用 |
| 7 | **`navigateTo` 层级上限 10 层** | 深层嵌套页面无法继续跳转 | 合理使用 `redirectTo` 和 `navigateBack`，避免深层跳转链 |
| 8 | **组件 observers 不支持监听深层属性** | `objection.xxx` 变化不触发 observer | 使用 `'objection.xxx'` 单独监听，或在 JS 层手动触发 |
| 9 | **`wx.getSystemInfoSync` 等同步 API 消耗性能** | 频繁调用影响帧率 | 缓存结果（如 `screenWidth`），attached 时获取一次即可 |
| 10 | **小程序无 `window`/`document`/`XMLHttpRequest`** | 浏览器端代码无法直接复用 | 使用 `wx.request` 替代 XHR，Canvas 2D API 绘图 |
| 11 | **`setData` 深拷贝数据，丢弃 `_` 前缀属性** | `this.setData({ _flag: true })` 后 `this.data._flag` 为 `undefined`；嵌套对象中的 `_` 前缀属性同样被剥离 | 运行时标记（如"是否刚创建"）**禁止放入 `data`**，改用页面实例属性（`this._flag = true`，不经过 `setData`）|
| 12 | **EventChannel 传对象时，嵌套的 `_` 前缀属性也会被序列化剥离** | 跨页通信传 `{ id: 1, _justCreated: true }` → 接收方拿到 `{ id: 1 }` | 跨页传递运行时标记用**独立字段**（如 `{ items, justCreatedIds }`），不要嵌在对象属性里 |
| 13 | **`onLoad` options 参数均为字符串，id=0 经 `parseInt` 后是 falsy** | `if (id)` 当 id=0 时跳过加载逻辑，页面退化为空白/新建状态 | 判断 id 是否存在用 `id !== null`，不用 `if (id)`；解析时用 `options.id !== undefined && options.id !== ''` 而非 `options.id ?` |

---

## 八、AI 编辑操作规范

### 核心原则：Edit 优先，Write 最后手段

| 场景 | 策略 | 原因 |
|------|------|------|
| **连续 15-100 行替换** | `Edit` 一次搞定 | old_string 包含足够上下文，唯一性没问题 |
| **同一文件 2-3 处相邻编辑**（间距 <20 行） | `Edit` 合并为一次 | 减少调用次数，一次替换包含所有改动 |
| **同一文件多处分散编辑** | 多次 `Edit` | 每次精确匹配，比重写全文件省 token |
| **文件结构大改**（>50% 代码变动） | `Write` | 此时重写反而更清晰 |
| **超大文件**（>500 行）需大量编辑 | **写 Node 脚本做变换** | 脚本本地执行，零 token 消耗 |

### 判断标准：编辑分散度

- **低分散度**：改动集中在 1-2 个区域 → `Edit`
- **高分散度**：改动涉及 3+ 个不相邻区域 → 多次 `Edit`，每次精确匹配
- **结构大改**：文件需要重新组织 → `Write`

### 大文件批量修改方案

当超大文件（>500 行）需要大量散点编辑时：

1. 写一个临时 Node 脚本（如 `_transform.js`）做变换
2. 脚本读取源文件，用正则/字符串操作完成所有修改
3. 输出到新文件或覆盖原文件
4. 执行后删除临时脚本

```bash
node -e "
const fs = require('fs');
let code = fs.readFileSync('miniprogram/pages/xxx/index.js', 'utf8');
code = code.replace(/old_field/g, 'new_field');
fs.writeFileSync('miniprogram/pages/xxx/index.js', code);
"
```

### 结构完整性校验

- `Edit` 的 `old_string` 必须包含足够的上下文确保唯一匹配
- 替换后确认括号/花括号/方括号闭合正确
- 同一文件超过 3 次替换时，完成后读取文件关键区域做完整性验证

---

## 附录：通用行为准则

> 适用于所有项目的 LLM 编码行为约束，与上方项目规则配合使用。

### A. 动手前先想清楚

**不要假设。不要隐藏困惑。把权衡说出来。**

- 明确说出你的假设。不确定就问。
- 如果存在多种理解，列出来——不要默默选一个。
- 如果有更简单的方案，说出来。有必要时反驳。
- 如果有不清楚的地方，停下来，说清楚是什么让你困惑，然后问。

### B. 简单优先

**最少的代码解决问题，不写推测性的代码。**

- 不写超出需求的功能。
- 不为单次使用的代码抽象。
- 不写没被要求的"灵活性"或"可配置性"。
- 不为不可能发生的场景写错误处理。
- 如果写了 200 行但 50 行就够，重写它。

### C. 外科手术式修改

**只动必须动的。只清理自己制造的烂摊子。**

编辑已有代码时：
- 不"顺便改进"周边代码、注释或格式。
- 不重构没坏的东西。
- 匹配现有风格，即使你会用不同方式写。
- 发现无关的死代码，提一句——不要删。

当你的修改制造了孤儿：
- 移除**你的修改**导致的无用 import/变量/函数。
- 不移除已有的死代码，除非被要求。

### D. 目标驱动执行

**定义成功标准，循环直到验证完成。**

把任务转化为可验证的目标：
- "添加校验" → "写出无效输入的测试，然后让它通过"
- "修复 bug" → "写出复现 bug 的测试，然后让它通过"
- "重构 X" → "确保重构前后测试都通过"

多步骤任务，先列简短计划：
```
1. [步骤] → 验证：[检查项]
2. [步骤] → 验证：[检查项]
3. [步骤] → 验证：[检查项]
```

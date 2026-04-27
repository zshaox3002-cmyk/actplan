# Dev 开发规范 — 保险代理人活动管理小程序

> 本文件为 Dev 角色在本空间的开发行为约束，每次新建会话时必须首先加载并遵守。

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

---

## 三、数据层规范

| 规则 | 说明 |
|------|------|
| ✅ 所有存储操作通过 `utils/repository/*` | Repository 层统一封装，禁止页面直接调用 storage |
| ❌ 禁止在页面 JS 里直接调用 `storage.getTable/setTable` | 仅 repo 层可直接操作 storage（已知例外：`visit-record/detail/index.js` 直接读 plan 表，应后续修正） |
| ✅ 事务操作使用 `storage.transaction()` | 拜访记录创建、异议备注追加等涉及多表更新的场景必须使用事务 |
| ✅ 页面 `onLoad`/`onShow` 开头调用 `storage.waitReady()` | 确保存储初始化完成（异步） |
| ✅ 修改数据结构前查阅 `DATA_RELATIONSHIP.md` | 确认影响面，同步更新关系表文档 |
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

_本文件由 Dev 维护，如有调整须同步更新。_

---

## 七、微信小程序平台限制清单

> 修改或新增功能时，必须对照此清单自查。涉及微信 API/组件时，主动查阅「微信小程序开发框架」skill 参考文档。

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

### Skill 使用规则

- 涉及微信 API 调用时，先查阅「微信小程序开发框架」skill 的 `api.md` 或 `components.md`
- 涉及框架机制（生命周期、事件系统、自定义组件）时，查阅 `framework.md`
- 涉及配置文件（app.json、页面 json）时，查阅 `reference.md`

---

## 八、AI 编辑操作规范

> 优化代码编辑的 token 消耗和准确性，替代旧版"15 行阈值"规则。

### 核心原则：`replace_in_file` 优先，`write_to_file` 最后手段

| 场景 | 策略 | 原因 |
|------|------|------|
| **连续 15-100 行替换** | `replace_in_file` 一次搞定 | old_string 包含足够上下文，唯一性没问题 |
| **同一文件 2-3 处相邻编辑**（间距 <20 行） | `replace_in_file` 合并为一次 | 减少调用次数，一次替换包含所有改动 |
| **同一文件多处分散编辑** | 多次 `replace_in_file` | 每次精确匹配，比重写全文件省 token |
| **文件结构大改**（>50% 代码变动） | `write_to_file` | 此时重写反而更清晰 |
| **超大文件**（>500 行）需大量编辑 | **写 Node 脚本做变换** | 脚本本地执行，零 token 消耗 |

### 判断标准：编辑分散度

**不再用"15 行"作为阈值**，而是判断"编辑分散度"：

- **低分散度**：改动集中在 1-2 个区域 → `replace_in_file`
- **高分散度**：改动涉及 3+ 个不相邻区域 → 多次 `replace_in_file`，每次精确匹配
- **结构大改**：文件需要重新组织 → `write_to_file`

### 大文件批量修改方案

当超大文件（>500 行）需要大量散点编辑时：

1. 写一个临时 Node 脚本（如 `_transform.js`）做变换
2. 脚本读取源文件，用正则/字符串操作完成所有修改
3. 输出到新文件或覆盖原文件
4. 执行后删除临时脚本

```bash
# 示例：批量替换字段名
node -e "
const fs = require('fs');
let code = fs.readFileSync('miniprogram/pages/xxx/index.js', 'utf8');
code = code.replace(/old_field/g, 'new_field');
fs.writeFileSync('miniprogram/pages/xxx/index.js', code);
"
```

### 结构完整性校验

- `replace_in_file` 的 `old_string` 必须包含足够的上下文确保唯一匹配
- 替换后确认括号/花括号/方括号闭合正确
- 同一文件超过 3 次替换时，完成后读取文件关键区域做完整性验证

# 数据关系说明

## 客户表（customer）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 主键，自增 |
| external_key | string\|null | 外部导入编号，可选，用于批量导入时做客户去重匹配 |
| name | string | 客户姓名，必填 |
| gender | string | 性别 |
| relation | string | 关系来源 |
| income | string | 年收入区间 |
| age_range | string | 年龄段 |
| occupation | string | 职业 |
| residence | string | 居住情况 |
| marital | string | 婚姻状况 |
| intimacy | string | 亲密度 |
| stage | string | 跟进阶段 |
| stage_updated_at | string\|null | 阶段最后变更时间（系统自动写入） |
| tags | string[] | 客户标签数组 |
| coverage_needs | Object | 保障需求（内部使用，不导入导出） |
| coverage_status | Object | 保障状态，含六个险种：重疾/医疗/教育金/养老/意外/寿险 |
| is_hnw | boolean | 是否高净值客户 |
| referral_count | number | 转介绍次数 |
| birthday | string\|null | 生日，格式 MM-DD |
| policy_expire_date | string\|null | 最近保单到期日，格式 YYYY-MM-DD |
| family | string | 家庭结构 |
| has_need | string | 有无需求：是/否/不确定 |
| has_ability | string | 有无购买力：是/否/不确定 |
| is_decider | string | 是否决策人：是/否/不确定 |
| coverage_gap | string | 保障缺口说明 |
| last_visit | string\|null | 最近拜访日期，格式 YYYY-MM-DD |
| visit_count | number | 拜访次数 |
| created_at | string | 创建时间 ISO 格式 |
| updated_at | string | 最后更新时间 ISO 格式 |

### coverage_status 说明

- `unknown`：未知
- `gap`：有缺口
- `none`：无需求
- `configured`：已有保障（由保单逻辑自动写入，禁止手动导入）

## 跨表关系

- customer → plan（一对多，customer_id）
- customer → visit_record（一对多，customer_id）
- customer → objection_note（一对多，customer_id）
- customer → policy（一对多，customer_id）
- policy → customer.coverage_status（保单激活时自动将对应险种设为 configured）

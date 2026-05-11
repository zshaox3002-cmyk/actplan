const CUSTOMER_HEADER = ['姓名*', '手机号*', '性别', '生日', '职业', '公司', '地址', '备注', '标签']
const RECORD_HEADER = ['客户手机号*', '拜访日期*', '拜访方式*', '拜访内容', '跟进结果', '下次拜访日期', '下次拜访备注']
const POLICY_HEADER = ['客户手机号*', '产品名称*', '险种', '年缴保费', '起保日期', '到期日期', '保单状态', '缴费期限', '保障期限']

function escapeCSV(val) {
  if (val === null || val === undefined) return ''
  const str = String(val)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

function buildRow(fields) {
  return fields.map(escapeCSV).join(',')
}

function buildCustomerCSV(customers) {
  const header = ['姓名', '手机号', '性别', '生日', '职业', '公司', '地址', '备注', '标签']
  const rows = [buildRow(header)]
  customers.forEach(function (c) {
    rows.push(buildRow([
      c.name, c.phone, c.gender, c.birthday, c.occupation,
      c.company, c.address, c.remark,
      Array.isArray(c.tags) ? c.tags.join('、') : (c.tags || '')
    ]))
  })
  return rows.join('\n')
}

function buildRecordCSV(records) {
  const header = ['客户手机号', '拜访日期', '拜访方式', '拜访内容', '跟进结果', '下次拜访日期', '下次拜访备注']
  const rows = [buildRow(header)]
  records.forEach(function (r) {
    rows.push(buildRow([
      r.customerPhone, r.visitDate, r.visitWay, r.content, r.result, r.nextVisitDate, r.nextVisitRemark
    ]))
  })
  return rows.join('\n')
}

function buildPolicyCSV(policies) {
  const header = ['客户手机号', '产品名称', '险种', '年缴保费', '起保日期', '到期日期', '保单状态', '缴费期限', '保障期限']
  const statusMap = { active: '有效', draft: '草稿', expired: '已到期' }
  const rows = [buildRow(header)]
  policies.forEach(function (p) {
    rows.push(buildRow([
      p.customerPhone, p.product_name, p.category, p.premium,
      p.effective_date, p.expire_date,
      statusMap[p.status] || p.status,
      p.payment_term, p.coverage_term
    ]))
  })
  return rows.join('\n')
}

function buildCustomerTemplateCSV() {
  const rows = [buildRow(CUSTOMER_HEADER)]
  rows.push(buildRow(['张三', '13800138000', '男', '1990-01-01', '教师', '第一中学', '北京市朝阳区', '重要客户', '教育、家庭']))
  rows.push(buildRow(['李四', '13900139000', '女', '1985-06-15', '医生', '人民医院', '上海市浦东新区', '', '医疗']))
  return rows.join('\n')
}

function buildRecordTemplateCSV() {
  const rows = [buildRow(RECORD_HEADER)]
  rows.push(buildRow(['13800138000', '2024-01-15', '电话', '介绍新产品', '客户感兴趣', '2024-01-22', '发送产品资料']))
  rows.push(buildRow(['13900139000', '2024-01-16', '面谈', '签单沟通', '已签单', '', '']))
  return rows.join('\n')
}

function buildPolicyTemplateCSV() {
  const rows = [buildRow(POLICY_HEADER)]
  rows.push(buildRow(['13800138000', '平安福终身寿险', '寿险', '5000', '2024-01-01', '2054-01-01', '有效', '20年', '终身']))
  rows.push(buildRow(['13900139000', '健康无忧重疾险', '重疾险', '3000', '2024-03-01', '2044-03-01', '有效', '20年', '20年']))
  return rows.join('\n')
}

module.exports = {
  buildCustomerCSV,
  buildRecordCSV,
  buildPolicyCSV,
  buildCustomerTemplateCSV,
  buildRecordTemplateCSV,
  buildPolicyTemplateCSV,
  CUSTOMER_HEADER,
  RECORD_HEADER,
  POLICY_HEADER
}

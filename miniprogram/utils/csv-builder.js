// CSV builder — generates export content with inline instructions
const CUSTOMER_HEADER = ['姓名', '手机号', '性别', '生日', '职业', '公司', '地址', '备注', '标签']
const RECORD_HEADER = ['客户手机号', '拜访日期', '拜访方式', '拜访内容', '跟进结果', '下次拜访日期', '下次拜访备注']

const CUSTOMER_INSTRUCTIONS = [
  '# === 填写说明（此行及 # 开头的行均为注释，导入时会自动忽略）===',
  '# 姓名：必填',
  '# 手机号：必填，11位手机号，如 13800138000',
  '# 性别：选填，只能填"男"或"女"',
  '# 生日：选填，格式 YYYY-MM-DD，如 1990-01-15',
  '# 职业/公司/地址/备注：选填，自由填写',
  '# 标签：选填，多个标签用顿号分隔，如 重要客户、转介绍',
].join('\n')

const RECORD_INSTRUCTIONS = [
  '# === 填写说明（此行及 # 开头的行均为注释，导入时会自动忽略）===',
  '# 客户手机号：必填，必须与客户列表中的手机号一致',
  '# 拜访日期：必填，格式 YYYY-MM-DD，如 2024-03-15',
  '# 拜访方式：必填，只能填：面访/电话/微信/视频/其他',
  '# 拜访内容/跟进结果：选填，自由填写',
  '# 下次拜访日期：选填，格式 YYYY-MM-DD',
  '# 下次拜访备注：选填，自由填写',
].join('\n')

function escapeCSVValue(val) {
  if (val === null || val === undefined) return ''
  const str = String(val)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

function buildRow(values) {
  return values.map(escapeCSVValue).join(',')
}

function buildCustomerCSV(customers) {
  const lines = [CUSTOMER_INSTRUCTIONS, buildRow(CUSTOMER_HEADER)]
  for (const c of customers) {
    lines.push(buildRow([
      c.name || '',
      c.phone || '',
      c.gender || '',
      c.birthday || '',
      c.occupation || '',
      c.company || '',
      c.address || '',
      c.remark || '',
      Array.isArray(c.tags) ? c.tags.join('、') : (c.tags || '')
    ]))
  }
  return lines.join('\n')
}

function buildRecordCSV(records) {
  const lines = [RECORD_INSTRUCTIONS, buildRow(RECORD_HEADER)]
  for (const r of records) {
    lines.push(buildRow([
      r.customerPhone || '',
      r.visitDate || '',
      r.visitType || '',
      r.content || '',
      r.result || '',
      r.nextVisitDate || '',
      r.nextVisitRemark || ''
    ]))
  }
  return lines.join('\n')
}

// Empty CSV for use as a template (no data rows)
function buildCustomerTemplateCSV() {
  return buildCustomerCSV([])
}

function buildRecordTemplateCSV() {
  return buildRecordCSV([])
}

module.exports = {
  buildCustomerCSV,
  buildRecordCSV,
  buildCustomerTemplateCSV,
  buildRecordTemplateCSV,
  CUSTOMER_HEADER,
  RECORD_HEADER
}

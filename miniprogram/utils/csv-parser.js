// CSV parser with field validation
const CUSTOMER_FIELDS = {
  required: ['姓名', '手机号'],
  optional: ['性别', '生日', '职业', '公司', '地址', '备注', '标签'],
  all: ['姓名', '手机号', '性别', '生日', '职业', '公司', '地址', '备注', '标签']
}

const RECORD_FIELDS = {
  required: ['客户手机号', '拜访日期', '拜访方式'],
  optional: ['拜访内容', '跟进结果', '下次拜访日期', '下次拜访备注'],
  all: ['客户手机号', '拜访日期', '拜访方式', '拜访内容', '跟进结果', '下次拜访日期', '下次拜访备注']
}

const VISIT_TYPES = ['面访', '电话', '微信', '视频', '其他']
const GENDERS = ['男', '女', '']
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const PHONE_REGEX = /^1[3-9]\d{9}$/

function parseCSV(content) {
  const lines = content.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))
  if (lines.length < 2) return { headers: [], rows: [] }

  const headers = parseCSVLine(lines[0])
  const rows = lines.slice(1).map((line, i) => ({
    lineNum: i + 2,
    values: parseCSVLine(line)
  }))

  return { headers, rows }
}

function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

function validateCustomerCSV(content) {
  const { headers, rows } = parseCSV(content)
  const errors = []

  // Check for unknown columns
  const unknownCols = headers.filter(h => !CUSTOMER_FIELDS.all.includes(h))
  if (unknownCols.length > 0) {
    errors.push(`表头包含未知字段：${unknownCols.join('、')}`)
  }

  // Check required columns exist
  for (const req of CUSTOMER_FIELDS.required) {
    if (!headers.includes(req)) {
      errors.push(`缺少必填列：${req}`)
    }
  }

  if (errors.length > 0) return { valid: false, errors, data: null }

  const data = []
  for (const { lineNum, values } of rows) {
    const row = {}
    headers.forEach((h, i) => { row[h] = values[i] || '' })

    const rowErrors = []

    if (!row['姓名']) rowErrors.push('姓名不能为空')
    if (!row['手机号']) {
      rowErrors.push('手机号不能为空')
    } else if (!PHONE_REGEX.test(row['手机号'])) {
      rowErrors.push(`手机号格式错误（应为11位手机号，当前值："${row['手机号']}"）`)
    }

    if (row['性别'] !== undefined && !GENDERS.includes(row['性别'])) {
      rowErrors.push(`性别只能填"男"或"女"（当前值："${row['性别']}"）`)
    }

    if (row['生日'] && !DATE_REGEX.test(row['生日'])) {
      rowErrors.push(`生日格式错误（应为 YYYY-MM-DD，当前值："${row['生日']}"）`)
    }

    if (rowErrors.length > 0) {
      errors.push(`第 ${lineNum} 行：${rowErrors.join('；')}`)
    } else {
      data.push(row)
    }
  }

  if (errors.length > 0) return { valid: false, errors, data: null }
  return { valid: true, errors: [], data }
}

function validateRecordCSV(content) {
  const { headers, rows } = parseCSV(content)
  const errors = []

  const unknownCols = headers.filter(h => !RECORD_FIELDS.all.includes(h))
  if (unknownCols.length > 0) {
    errors.push(`表头包含未知字段：${unknownCols.join('、')}`)
  }

  for (const req of RECORD_FIELDS.required) {
    if (!headers.includes(req)) {
      errors.push(`缺少必填列：${req}`)
    }
  }

  if (errors.length > 0) return { valid: false, errors, data: null }

  const data = []
  for (const { lineNum, values } of rows) {
    const row = {}
    headers.forEach((h, i) => { row[h] = values[i] || '' })

    const rowErrors = []

    if (!row['客户手机号']) {
      rowErrors.push('客户手机号不能为空')
    } else if (!PHONE_REGEX.test(row['客户手机号'])) {
      rowErrors.push(`客户手机号格式错误（应为11位手机号，当前值："${row['客户手机号']}"）`)
    }

    if (!row['拜访日期']) {
      rowErrors.push('拜访日期不能为空')
    } else if (!DATE_REGEX.test(row['拜访日期'])) {
      rowErrors.push(`拜访日期格式错误（应为 YYYY-MM-DD，当前值："${row['拜访日期']}"）`)
    }

    if (!row['拜访方式']) {
      rowErrors.push('拜访方式不能为空')
    } else if (!VISIT_TYPES.includes(row['拜访方式'])) {
      rowErrors.push(`拜访方式只能填：${VISIT_TYPES.join('/')}（当前值："${row['拜访方式']}"）`)
    }

    if (row['下次拜访日期'] && !DATE_REGEX.test(row['下次拜访日期'])) {
      rowErrors.push(`下次拜访日期格式错误（应为 YYYY-MM-DD，当前值："${row['下次拜访日期']}"）`)
    }

    if (rowErrors.length > 0) {
      errors.push(`第 ${lineNum} 行：${rowErrors.join('；')}`)
    } else {
      data.push(row)
    }
  }

  if (errors.length > 0) return { valid: false, errors, data: null }
  return { valid: true, errors: [], data }
}

module.exports = { parseCSV, validateCustomerCSV, validateRecordCSV, CUSTOMER_FIELDS, RECORD_FIELDS }

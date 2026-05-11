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

const POLICY_FIELDS = {
  required: ['客户手机号', '产品名称'],
  optional: ['险种', '年缴保费', '起保日期', '到期日期', '保单状态', '缴费期限', '保障期限'],
  all: ['客户手机号', '产品名称', '险种', '年缴保费', '起保日期', '到期日期', '保单状态', '缴费期限', '保障期限']
}

function parseCSV(content) {
  const lines = content.trim().split('\n')
  if (lines.length < 2) return []
  // strip * markers from template headers
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"|\*$/g, '').trim())
  const result = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const values = parseCSVLine(line)
    const obj = {}
    headers.forEach((h, idx) => {
      obj[h] = values[idx] !== undefined ? values[idx].trim() : ''
    })
    result.push(obj)
  }
  return result
}

function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}

function validateCustomerCSV(content) {
  const rows = parseCSV(content)
  if (rows.length === 0) return { valid: false, errors: ['文件为空或格式错误'], data: [] }

  const errors = []
  const data = []

  rows.forEach(function (row, idx) {
    const rowNum = idx + 2
    const rowErrors = []

    CUSTOMER_FIELDS.required.forEach(function (field) {
      if (!row[field] || !row[field].trim()) {
        rowErrors.push('缺少必填项：' + field)
      }
    })

    if (row['手机号'] && !/^1[3-9]\d{9}$/.test(row['手机号'].trim())) {
      rowErrors.push('手机号格式错误')
    }

    if (rowErrors.length > 0) {
      errors.push('第' + rowNum + '行：' + rowErrors.join('；'))
    } else {
      data.push(row)
    }
  })

  return { valid: errors.length === 0, errors, data }
}

function validateRecordCSV(content) {
  const rows = parseCSV(content)
  if (rows.length === 0) return { valid: false, errors: ['文件为空或格式错误'], data: [] }

  const errors = []
  const data = []

  rows.forEach(function (row, idx) {
    const rowNum = idx + 2
    const rowErrors = []

    RECORD_FIELDS.required.forEach(function (field) {
      if (!row[field] || !row[field].trim()) {
        rowErrors.push('缺少必填项：' + field)
      }
    })

    if (row['客户手机号'] && !/^1[3-9]\d{9}$/.test(row['客户手机号'].trim())) {
      rowErrors.push('客户手机号格式错误')
    }

    if (rowErrors.length > 0) {
      errors.push('第' + rowNum + '行：' + rowErrors.join('；'))
    } else {
      data.push(row)
    }
  })

  return { valid: errors.length === 0, errors, data }
}

function validatePolicyCSV(content) {
  const rows = parseCSV(content)
  if (rows.length === 0) return { valid: false, errors: ['文件为空或格式错误'], data: [] }

  const errors = []
  const data = []

  rows.forEach(function (row, idx) {
    const rowNum = idx + 2
    const rowErrors = []

    POLICY_FIELDS.required.forEach(function (field) {
      if (!row[field] || !row[field].trim()) {
        rowErrors.push('缺少必填项：' + field)
      }
    })

    if (row['客户手机号'] && !/^1[3-9]\d{9}$/.test(row['客户手机号'].trim())) {
      rowErrors.push('客户手机号格式错误')
    }

    if (rowErrors.length > 0) {
      errors.push('第' + rowNum + '行：' + rowErrors.join('；'))
    } else {
      data.push(row)
    }
  })

  return { valid: errors.length === 0, errors, data }
}

module.exports = {
  parseCSV,
  validateCustomerCSV,
  validateRecordCSV,
  validatePolicyCSV,
  CUSTOMER_FIELDS,
  RECORD_FIELDS,
  POLICY_FIELDS
}

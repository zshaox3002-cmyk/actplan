const { validateCustomerCSV, validateRecordCSV, validatePolicyCSV } = require('./csv-parser')
const customerRepo = require('./repository/customer.repo')
const recordRepo = require('./repository/record.repo')
const storage = require('./storage')

function importCustomersFromCSV(content) {
  const { valid, errors, data } = validateCustomerCSV(content)
  if (!valid) return { success: false, errors }

  let importedCount = 0
  let skippedCount = 0

  data.forEach(function (row) {
    const phone = row['手机号'].trim()
    const existing = customerRepo.findByPhone(phone)
    if (existing) {
      skippedCount++
      return
    }
    customerRepo.create({
      name: row['姓名'].trim(),
      phone: phone,
      gender: row['性别'] || '',
      birthday: row['生日'] || '',
      occupation: row['职业'] || '',
      company: row['公司'] || '',
      address: row['地址'] || '',
      remark: row['备注'] || '',
      tags: row['标签'] ? row['标签'].split(/[、,]/).map(t => t.trim()).filter(Boolean) : []
    })
    importedCount++
  })

  return { success: true, importedCount, skippedCount }
}

function importRecordsFromCSV(content) {
  const { valid, errors, data } = validateRecordCSV(content)
  if (!valid) return { success: false, errors }

  let importedCount = 0
  const warnings = []

  data.forEach(function (row) {
    const phone = row['客户手机号'].trim()
    const customer = customerRepo.findByPhone(phone)
    if (!customer) {
      warnings.push('未找到手机号为 ' + phone + ' 的客户，该行已跳过')
      return
    }
    recordRepo.create({
      customer_id: customer.id,
      visit_date: row['拜访日期'] || '',
      visit_way: row['拜访方式'] || '',
      summary: row['拜访内容'] || '',
      comm_result: row['跟进结果'] || '',
      next_follow_date: row['下次拜访日期'] || '',
      next_follow_remark: row['下次拜访备注'] || ''
    })
    importedCount++
  })

  return { success: true, importedCount, warnings }
}

function importPoliciesFromCSV(content) {
  const { valid, errors, data } = validatePolicyCSV(content)
  if (!valid) return { success: false, errors }

  const statusMap = { '有效': 'active', '草稿': 'draft', '已到期': 'expired' }

  let importedCount = 0
  let skippedCount = 0

  data.forEach(function (row) {
    const phone = row['客户手机号'].trim()
    const customer = customerRepo.findByPhone(phone)
    if (!customer) {
      skippedCount++
      return
    }

    // dedup: same customer + same product + same effective_date
    const existingPolicies = storage.getTable('policy')
    const effectiveDate = row['起保日期'] || ''
    const productName = row['产品名称'].trim()
    const duplicate = existingPolicies.some(function (p) {
      return p.customer_id === customer.id &&
        p.product_name === productName &&
        p.effective_date === effectiveDate
    })
    if (duplicate) {
      skippedCount++
      return
    }

    const policyRepo = require('./repository/policy.repo')
    policyRepo.create({
      customer_id: customer.id,
      product_name: productName,
      category: row['险种'] || '',
      premium: row['年缴保费'] ? Number(row['年缴保费']) : 0,
      effective_date: effectiveDate,
      expire_date: row['到期日期'] || '',
      status: statusMap[row['保单状态']] || 'active',
      payment_term: row['缴费期限'] || '',
      coverage_term: row['保障期限'] || ''
    })
    importedCount++
  })

  return { success: true, importedCount, skippedCount }
}

module.exports = {
  importCustomersFromCSV,
  importRecordsFromCSV,
  importPoliciesFromCSV
}

const { validateCustomerCSV, validateRecordCSV } = require('./csv-parser')
const customerRepo = require('./repository/customer.repo')
const recordRepo = require('./repository/record.repo')

function importCustomersFromCSV(content) {
  const { valid, errors, data } = validateCustomerCSV(content)
  if (!valid) return { success: false, errors }

  let importedCount = 0
  let skippedCount = 0

  for (const row of data) {
    const phone = row['手机号']
    const allCustomers = customerRepo.list({})
    const existing = allCustomers.find(c => c.phone === phone)
    if (existing) {
      skippedCount++
      continue
    }
    customerRepo.create({
      name: row['姓名'],
      phone: phone,
      gender: row['性别'] || '',
      birthday: row['生日'] || null,
      occupation: row['职业'] || '',
      tags: row['标签'] ? row['标签'].split(/[、,]/).map(t => t.trim()).filter(Boolean) : [],
    })
    importedCount++
  }

  return { success: true, importedCount, skippedCount }
}

function importRecordsFromCSV(content) {
  const { valid, errors, data } = validateRecordCSV(content)
  if (!valid) return { success: false, errors }

  const allCustomers = customerRepo.list({})
  let importedCount = 0
  const warnings = []

  for (const row of data) {
    const phone = row['客户手机号']
    const customer = allCustomers.find(c => c.phone === phone)
    if (!customer) {
      warnings.push(`手机号 ${phone} 未找到对应客户，该行已跳过`)
      continue
    }
    recordRepo.create({
      customer_id: customer.id,
      visit_date: row['拜访日期'],
      visit_way: row['拜访方式'],
      summary: row['拜访内容'] || '',
      comm_result: row['跟进结果'] || '',
      next_follow_date: row['下次拜访日期'] || null,
      record_type: 'adhoc',
      is_deal: '未成交',
    })
    importedCount++
  }

  return { success: true, importedCount, warnings }
}

module.exports = { importCustomersFromCSV, importRecordsFromCSV }

const customerRepo = require('./repository/customer.repo')
const recordRepo = require('./repository/record.repo')
const { buildCustomerCSV, buildRecordCSV } = require('./csv-builder')

function formatDate() {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}${m}${day}`
}

function exportCustomers() {
  const customers = customerRepo.list({})
  return {
    content: buildCustomerCSV(customers),
    filename: `客户数据_${formatDate()}.csv`,
    count: customers.length,
  }
}

function exportRecords() {
  const records = recordRepo.list()
  const customers = customerRepo.list({})
  const phoneMap = {}
  for (const c of customers) phoneMap[c.id] = c.phone || ''
  const enriched = records.map(r => ({
    customerPhone: phoneMap[r.customer_id] || '',
    visitDate: r.visit_date || '',
    visitType: r.visit_way || '',
    content: r.summary || '',
    result: r.comm_result || '',
    nextVisitDate: r.next_follow_date || '',
    nextVisitRemark: '',
  }))
  return {
    content: buildRecordCSV(enriched),
    filename: `拜访记录_${formatDate()}.csv`,
    count: records.length,
  }
}

module.exports = { exportCustomers, exportRecords }

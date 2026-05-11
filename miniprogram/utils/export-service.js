const customerRepo = require('./repository/customer.repo')
const recordRepo = require('./repository/record.repo')
const storage = require('./storage')
const { buildCustomerCSV, buildRecordCSV, buildPolicyCSV } = require('./csv-builder')

function exportCustomers() {
  const customers = customerRepo.list()
  return buildCustomerCSV(customers)
}

function exportRecords() {
  const records = recordRepo.list()
  const enriched = records.map(function (r) {
    const customer = customerRepo.findById(r.customer_id)
    return {
      customerPhone: customer ? customer.phone : '',
      visitDate: r.visit_date,
      visitWay: r.visit_way,
      content: r.summary,
      result: r.comm_result,
      nextVisitDate: r.next_follow_date,
      nextVisitRemark: r.next_follow_remark
    }
  })
  return buildRecordCSV(enriched)
}

function exportPolicies() {
  const policies = storage.getTable('policy')
  const enriched = policies.map(function (p) {
    const customer = customerRepo.findById(p.customer_id)
    return Object.assign({}, p, {
      customerPhone: customer ? customer.phone : ''
    })
  })
  return buildPolicyCSV(enriched)
}

module.exports = {
  exportCustomers,
  exportRecords,
  exportPolicies
}

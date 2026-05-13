/**
 * insured-member.repo.js — 保障对象（被保险人档案）CRUD
 * 管理 db_insured_member 表
 */

var storage = require('../storage');
var id = require('../id');

var RELATION_OPTIONS = ['本人', '配偶', '子女', '父母', '其他'];

/**
 * 根据关系和已有同关系数量生成默认显示名称
 * @param {string} relation
 * @param {string} customerName - 仅"本人"时使用
 * @param {number} sameRelationCount - 已有同关系数量（用于子女1/子女2等）
 * @returns {string}
 */
function generateDisplayName(relation, customerName, sameRelationCount) {
  if (relation === '本人') return customerName || '本人';
  if (relation === '配偶') return '配偶';
  var suffix = sameRelationCount > 0 ? String(sameRelationCount + 1) : '1';
  return relation + suffix;
}

/**
 * 获取客户的全部保障对象，按 created_at 升序
 * @param {number} customerId
 * @returns {Array<Object>}
 */
function listByCustomer(customerId) {
  var all = storage.getTable('insured_member');
  return all
    .filter(function (m) { return m.customer_id === customerId; })
    .sort(function (a, b) { return (a.created_at || 0) - (b.created_at || 0); });
}

/**
 * 获取单个保障对象
 * @param {number} memberId
 * @returns {Object|null}
 */
function get(memberId) {
  var all = storage.getTable('insured_member');
  for (var i = 0; i < all.length; i++) {
    if (all[i].id === memberId) return all[i];
  }
  return null;
}

/**
 * 创建保障对象
 * @param {Object} data
 * @param {number} data.customer_id
 * @param {string} data.relation - 本人/配偶/子女/父母/其他
 * @param {string} [data.display_name] - 若不传则自动生成
 * @param {boolean} [data.is_default]
 * @returns {Object} 新建的保障对象
 */
function create(data) {
  var all = storage.getTable('insured_member');
  var newId = id.nextId('insured_member');
  var now = Date.now();

  var displayName = data.display_name;
  if (!displayName) {
    var sameRelationCount = all.filter(function (m) {
      return m.customer_id === data.customer_id && m.relation === data.relation;
    }).length;
    displayName = generateDisplayName(data.relation, '', sameRelationCount);
  }

  var member = {
    id: newId,
    customer_id: data.customer_id,
    relation: data.relation,
    display_name: displayName,
    is_default: data.is_default || false,
    created_at: now,
    updated_at: now
  };

  all.push(member);
  storage.setTable('insured_member', all);
  return member;
}

/**
 * 更新保障对象字段（仅 display_name 可更新）
 * @param {number} memberId
 * @param {Object} fields - { display_name? }
 * @returns {boolean}
 */
function update(memberId, fields) {
  var all = storage.getTable('insured_member');
  var found = false;
  for (var i = 0; i < all.length; i++) {
    if (all[i].id === memberId) {
      if (fields.display_name !== undefined) all[i].display_name = fields.display_name;
      all[i].updated_at = Date.now();
      found = true;
      break;
    }
  }
  if (found) storage.setTable('insured_member', all);
  return found;
}

/**
 * 确保客户有默认"本人"保障对象，若无则自动创建
 * @param {number} customerId
 * @param {string} customerName
 * @returns {Object} 本人保障对象
 */
function ensureDefaultMember(customerId, customerName) {
  var members = listByCustomer(customerId);
  for (var i = 0; i < members.length; i++) {
    if (members[i].is_default) return members[i];
  }
  return create({
    customer_id: customerId,
    relation: '本人',
    display_name: customerName || '本人',
    is_default: true
  });
}

module.exports = {
  RELATION_OPTIONS: RELATION_OPTIONS,
  generateDisplayName: generateDisplayName,
  listByCustomer: listByCustomer,
  get: get,
  create: create,
  update: update,
  ensureDefaultMember: ensureDefaultMember
};

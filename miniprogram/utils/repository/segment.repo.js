/**
 * segment.repo.js — 客户视图 CRUD（v1.1 新增）
 * 管理 db_segment 表，系统预设视图（is_system=true）不可删除，仅可编辑 rules/sort
 */

var storage = require('../storage');
var id = require('../id');

/** 自建视图上限 */
var MAX_USER_SEGMENTS = 10;

/**
 * 获取全部视图，系统预设在前，自建按创建时间升序
 * @returns {Array<Object>}
 */
function listAll() {
  var all = storage.getTable('segment');
  return all.sort(function (a, b) {
    if (a.is_system !== b.is_system) return a.is_system ? -1 : 1;
    return (a.created_at || 0) - (b.created_at || 0);
  });
}

/**
 * 新建自建视图
 * @param {Object} data
 * @param {string} data.name - 视图名（必填，最长 12 字）
 * @param {string} data.color - 颜色枚举（gold/purple/blue/green/gray）
 * @param {Object} data.rules - 规则 JSON
 * @param {Object} data.sort - 排序规则
 * @returns {Object} 新建的视图记录
 * @throws {Error} 超出上限时抛错
 */
function create(data) {
  var all = storage.getTable('segment');

  // 检查自建视图数量上限
  var userCount = all.filter(function (s) { return !s.is_system; }).length;
  if (userCount >= MAX_USER_SEGMENTS) {
    throw new Error('自建视图已达上限（' + MAX_USER_SEGMENTS + ' 个）');
  }

  var newId = id.nextId('segment');
  var now = Date.now();

  var segment = {
    id: newId,
    name: data.name,
    color: data.color || null,
    rules: data.rules,
    sort: data.sort || { field: 'created_at', order: 'desc' },
    is_system: false,
    created_at: now,
    updated_at: now
  };

  all.push(segment);
  storage.setTable('segment', all);
  return segment;
}

/**
 * 更新视图
 * - 系统预设：仅允许更新 rules / sort
 * - 自建视图：可更新 name / color / rules / sort
 * @param {number} segmentId
 * @param {Object} fields
 * @returns {boolean}
 */
function update(segmentId, fields) {
  var all = storage.getTable('segment');
  var found = false;

  for (var i = 0; i < all.length; i++) {
    if (all[i].id === segmentId) {
      var seg = all[i];
      if (seg.is_system) {
        // 系统预设只允许更新规则和排序
        if (fields.rules !== undefined) seg.rules = fields.rules;
        if (fields.sort !== undefined) seg.sort = fields.sort;
      } else {
        var editableFields = ['name', 'color', 'rules', 'sort'];
        for (var k = 0; k < editableFields.length; k++) {
          var f = editableFields[k];
          if (fields[f] !== undefined) seg[f] = fields[f];
        }
      }
      seg.updated_at = Date.now();
      found = true;
      break;
    }
  }

  if (found) {
    storage.setTable('segment', all);
  }
  return found;
}

/**
 * 删除自建视图
 * @param {number} segmentId
 * @returns {boolean}
 * @throws {Error} 尝试删除系统预设时抛错
 */
function remove(segmentId) {
  var all = storage.getTable('segment');
  var target = null;

  for (var i = 0; i < all.length; i++) {
    if (all[i].id === segmentId) {
      target = all[i];
      break;
    }
  }

  if (!target) return false;
  if (target.is_system) throw new Error('系统预设视图不可删除');

  var remaining = all.filter(function (s) { return s.id !== segmentId; });
  storage.setTable('segment', remaining);
  return true;
}

/**
 * 获取自建视图数量（用于判断是否达到上限）
 * @returns {number}
 */
function getUserCount() {
  var all = storage.getTable('segment');
  return all.filter(function (s) { return !s.is_system; }).length;
}

module.exports = {
  listAll: listAll,
  create: create,
  update: update,
  remove: remove,
  getUserCount: getUserCount,
  MAX_USER_SEGMENTS: MAX_USER_SEGMENTS
};

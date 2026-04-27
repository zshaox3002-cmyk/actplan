/**
 * objection.repo.js — 异议池 CRUD
 * 基于 storage.js + id.js
 * appendNote() 必须走 storage.transaction，保证多表联动原子性
 *
 * 数据来源：
 * - 预置异议（PRESET_OBJECTIONS）：系统内置，不可删除，有 isPreset/isOfficial 标识
 * - 用户自建异议：存储在 objection 表中
 * - 预置关联记录：存储在 objection_links 表中（用户选择预置异议时写入）
 */

var storage = require('../storage');
var id = require('../id');
var dateUtil = require('../date');

/** 引入预置异议数据 */
var _presetModule;
try { _presetModule = require('../objection-preset'); } catch (e) { _presetModule = null; }
var PRESET_OBJECTIONS = (_presetModule && _presetModule.PRESET_OBJECTIONS) || [];

/**
 * 初始化存储时确保 objection_links 表存在
 */
function _ensureLinksTable() {
  try {
    var links = storage.getTable('objection_links');
    if (!links) {
      storage.setTable('objection_links', []);
    }
  } catch (e) {
    storage.setTable('objection_links', []);
  }
}

/** 在首次调用时确保表存在 */
_ensureLinksTable();

/**
 * 查询异议列表（合并预置 + 用户自建）
 * @param {Object} [filters]
 * @param {string} [filters.category] - 分类筛选（空或'全部'不过滤）
 * @param {string} [filters.sortBy] - 排序方式：'count'（出现次数降序）| 'created_at'（最近创建降序）
 * @returns {Array<Object>} 合并后的列表：[...presets, ...custom]
 */
function list(filters) {
  filters = filters || {};

  // 1. 用户自建数据
  var userObjections = storage.getTable('objection') || [];

  // 2. 构建预设异议的计数（从 objection_links 关联表中统计）
  var links = storage.getTable('objection_links') || [];
  var countMap = {};
  for (var i = 0; i < links.length; i++) {
    var lid = links[i].presetId;
    if (lid) countMap[lid] = (countMap[lid] || 0) + 1;
  }

  // 3. 合并预置异议（带实际出现次数）
  var presets = PRESET_OBJECTIONS.map(function (p) {
    return Object.assign({}, p, { occurrenceCount: countMap[p.id] || 0 });
  });

  // 4. 用户自建异议（非预置的）
  var custom = userObjections.filter(function (o) { return !o.presetId && !o.isPreset; });

  // 5. 合并结果
  var result = presets.concat(custom);

  // 6. 分类筛选
  if (filters.category && filters.category !== '全部') {
    result = result.filter(function (o) { return o.category === filters.category; });
  }

  // 7. 排序
  var sortBy = filters.sortBy || 'count';
  result = result.slice().sort(function (a, b) {
    if (sortBy === 'count') {
      return ((b.occurrenceCount || b.count || 0)) - ((a.occurrenceCount || a.count || 0));
    }
    // 默认按出现次数降序（预置优先排前面），再按创建时间
    if (a.isPreset !== b.isPreset) return a.isPreset ? -1 : 1;
    return (b.created_at || '').localeCompare(a.created_at || '');
  });

  return result;
}

/**
 * 查询指定分类的异议（新建时展示同类已有记录）
 * @param {string} category - 异议分类
 * @returns {Array<Object>}
 */
function listByCategory(category) {
  var all = storage.getTable('objection');
  return all.filter(function (o) {
    return o.category === category;
  }).sort(function (a, b) {
    return (b.count || 0) - (a.count || 0);
  });
}

/**
 * 独立新建异议
 * @param {Object} data
 * @param {number} data.customer_id - 关联客户 ID
 * @param {string} data.content - 异议内容（必填）
 * @param {string} data.category - 异议分类（必填）
 * @param {string} data.solution - 应对话术（必填）
 * @returns {Object} 新建异议对象（含 id）
 */
function create(data) {
  var all = storage.getTable('objection');
  var newId = id.nextId('objection');
  var now = dateUtil.nowISO();

  var objection = {
    id: newId,
    customer_id: data.customer_id || null,
    content: data.content || '',
    category: data.category || '其他',
    solution: data.solution || '',
    count: 1,
    created_at: now
  };

  all.push(objection);
  storage.setTable('objection', all);

  return objection;
}

/**
 * 追加备注到已有异议（事务）
 * 支持预置异议 ID（如 'preset_price_01'）和自建异议数字 ID
 * 事务内操作：
 * - 预置异议：插入 objection_note + objection_links 计数 +1
 * - 自建异议：插入 objection_note + objection.count += 1
 *
 * @param {number|string} objectionId - 目标异议 ID（数字=自建，字符串=预置）
 * @param {number} customerId - 关联客户 ID
 * @param {string} note - 追加备注内容
 * @returns {number} 新 note ID
 */
function appendNote(objectionId, customerId, note) {
  // 先判断是否为预置异议
  var isPreset = false;
  for (var p = 0; p < PRESET_OBJECTIONS.length; p++) {
    if (PRESET_OBJECTIONS[p].id === objectionId) {
      isPreset = true;
      break;
    }
  }

  var newNoteId = null;

  storage.transaction(function (ctx) {
    var notes = ctx.getTableRef('objection_note');
    var now = dateUtil.nowISO();
    newNoteId = id.nextId('objection_note');

    // 1. 插入追加备注（预置和自建共用）
    notes.push({
      id: newNoteId,
      objection_id: objectionId,
      customer_id: customerId,
      note: note,
      created_at: now
    });
    ctx.setTable('objection_note', notes);

    // 2. 更新计数
    if (isPreset) {
      // 预置异议：通过 objection_links 计数
      var links = ctx.getTableRef('objection_links');
      links.push({
        presetId: objectionId,
        created_at: now
      });
      ctx.setTable('objection_links', links);
    } else {
      // 自建异议：更新 objection 表的 count
      var objections = ctx.getTableRef('objection');
      var found = false;
      for (var i = 0; i < objections.length; i++) {
        if (objections[i].id === objectionId) {
          objections[i].count = (objections[i].count || 0) + 1;
          found = true;
          break;
        }
      }

      if (!found) {
        throw new Error('[ObjectionRepo] 异议不存在，id=' + objectionId);
      }

      ctx.setTable('objection', objections);
    }
  });

  return newNoteId;
}

/**
 * 查询某异议的全部追加备注，按时间倒序
 * @param {number} objectionId
 * @returns {Array<Object>}
 */
function listNotes(objectionId) {
  var all = storage.getTable('objection_note');
  return all
    .filter(function (n) { return n.objection_id === objectionId; })
    .sort(function (a, b) {
      return (b.created_at || '').localeCompare(a.created_at || '');
    });
}

/**
 * 删除异议（同时删除关联的追加备注）
 * @param {number} id - 异议 ID（仅支持用户自建，预置不可删）
 */
function remove(id) {
  // 预置异议不允许删除
  var all = storage.getTable('objection');
  var target = null;
  for (var i = 0; i < all.length; i++) {
    if (all[i].id === id) target = all[i];
  }
  if (target && target.isPreset) {
    throw new Error('[ObjectionRepo] 预置异议不可删除');
  }

  // 删除关联的追加备注
  var notes = storage.getTable('objection_note');
  var remainingNotes = notes.filter(function (n) { return n.objection_id !== id; });
  storage.setTable('objection_note', remainingNotes);

  // 删除异议本身
  var objections = storage.getTable('objection');
  var remainingObjections = objections.filter(function (o) { return o.id !== id; });
  if (remainingObjections.length === objections.length && !target) {
    throw new Error('[ObjectionRepo] 异议不存在，id=' + id);
  }
  storage.setTable('objection', remainingObjections);
}

/**
 * 预置异议计数 +1
 * 用户在拜访记录中选择预置异议时调用
 * @param {string} presetId - 预置异议的 id（如 'preset_price_01'）
 */
function incrementCount(presetId) {
  var links = storage.getTable('objection_links') || [];
  links.push({
    presetId: presetId,
    created_at: dateUtil.nowISO()
  });
  storage.setTable('objection_links', links);
}

/**
 * 获取单条异议（支持预置和自建）
 * @param {number|string} id - 数字ID（自建）或字符串ID（预置如 'preset_xxx'）
 * @returns {Object|null}
 */
function get(id) {
  // 先查预置
  for (var i = 0; i < PRESET_OBJECTIONS.length; i++) {
    if (PRESET_OBJECTIONS[i].id === id) {
      var links = storage.getTable('objection_links') || [];
      var countMap = {};
      for (var j = 0; j < links.length; j++) {
        countMap[links[j].presetId] = (countMap[links[j].presetId] || 0) + 1;
      }
      return Object.assign({}, PRESET_OBJECTIONS[i], { occurrenceCount: countMap[id] || 0 });
    }
  }
  // 再查用户自建
  var all = storage.getTable('objection');
  for (var k = 0; k < all.length; k++) {
    if (all[k].id === id) return all[k];
  }
  return null;
}

module.exports = {
  list: list,
  listByCategory: listByCategory,
  get: get,
  create: create,
  appendNote: appendNote,
  listNotes: listNotes,
  remove: remove,
  incrementCount: incrementCount,
  /** 获取纯预置列表（不合并用户数据） */
  getPresets: function () { return PRESET_OBJECTIONS.slice(); }
};

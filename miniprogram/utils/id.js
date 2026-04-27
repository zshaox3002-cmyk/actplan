/**
 * id.js — 自增主键生成器
 * 从 db_meta.nextId 中读取当前最大 id，+1 写回
 * 单线程同步调用，无并发问题
 */

var storage = require('./storage');

/**
 * 生成下一个自增 ID
 * @param {string} tableName - 表名
 * @returns {number} 新的 ID
 */
function nextId(tableName) {
  var meta = storage.getMeta();
  if (!meta.nextId) meta.nextId = {};
  if (typeof meta.nextId[tableName] !== 'number') {
    // 初始化：扫描表中已有最大 id
    var table = storage.getTable(tableName);
    var maxId = 0;
    for (var i = 0; i < table.length; i++) {
      if (table[i].id > maxId) maxId = table[i].id;
    }
    meta.nextId[tableName] = maxId;
  }
  meta.nextId[tableName] += 1;
  storage.persistMeta();
  return meta.nextId[tableName];
}

module.exports = {
  nextId: nextId
};

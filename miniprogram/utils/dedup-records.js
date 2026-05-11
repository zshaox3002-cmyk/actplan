/**
 * dedup-records.js — 一次性去重工具
 *
 * 用途：清理因保存按钮重复点击产生的重复拜访记录及其关联保单。
 * 去重键：customer_id + visit_date + visit_time + summary（完全相同才视为重复）
 * 策略：保留 id 最小（最早创建）的那条，删除后续重复条目及其关联 policy。
 *
 * 调用方须确保 storage 已初始化（storage.init() 已执行）。
 * 由 app.js onLaunch 调用一次，meta.dedup_v1_done 守卫防止重复执行。
 */

var storage = require('./storage');

/**
 * 执行去重，返回清理报告
 * @returns {{ removedRecords: number, removedPolicies: number }}
 */
function run() {
  var records = storage.getTable('visit_record');
  var policies = storage.getTable('policy');

  // 按去重键分组
  var groups = {};
  for (var i = 0; i < records.length; i++) {
    var r = records[i];
    var key = [
      r.customer_id,
      r.visit_date || '',
      r.visit_time || '',
      (r.summary || '').trim()
    ].join('|');

    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  }

  // 收集要删除的 record id
  var removeRecordIds = [];
  var keys = Object.keys(groups);
  for (var j = 0; j < keys.length; j++) {
    var group = groups[keys[j]];
    if (group.length <= 1) continue;

    // 按 id 升序，保留最小的（最早创建）
    group.sort(function (a, b) { return a.id - b.id; });
    var dups = group.slice(1);
    for (var k = 0; k < dups.length; k++) {
      removeRecordIds.push(dups[k].id);
    }
  }

  if (removeRecordIds.length === 0) {
    return { removedRecords: 0, removedPolicies: 0 };
  }

  // 找出关联这些重复 record 的 policy
  var removePolicyIds = [];
  for (var p = 0; p < policies.length; p++) {
    if (removeRecordIds.indexOf(policies[p].visit_record_id) !== -1) {
      removePolicyIds.push(policies[p].id);
    }
  }

  // 写回干净数据（setTable 会自动触发云同步）
  storage.setTable('visit_record', records.filter(function (r) {
    return removeRecordIds.indexOf(r.id) === -1;
  }));
  storage.setTable('policy', policies.filter(function (pol) {
    return removePolicyIds.indexOf(pol.id) === -1;
  }));

  return { removedRecords: removeRecordIds.length, removedPolicies: removePolicyIds.length };
}

/**
 * 清理重复异议（content + category + customer_id 完全相同则视为重复）
 * 策略：保留 id 最小的（最早创建），删除后续重复及关联的 objection_note。
 * 不处理预置异议（isPreset/presetId 标记的）。
 * @returns {{ removedObjections: number, removedNotes: number }}
 */
function runObjectionDedup() {
  var objections = storage.getTable('objection');
  var notes = storage.getTable('objection_note');

  var groups = {};
  for (var i = 0; i < objections.length; i++) {
    var o = objections[i];
    if (o.isPreset || o.presetId) continue;
    var key = [o.customer_id || '', o.content || '', o.category || ''].join('|');
    if (!groups[key]) groups[key] = [];
    groups[key].push(o);
  }

  var removeIds = [];
  var keys = Object.keys(groups);
  for (var j = 0; j < keys.length; j++) {
    var group = groups[keys[j]];
    if (group.length <= 1) continue;
    group.sort(function (a, b) { return a.id - b.id; });
    var dups = group.slice(1);
    for (var k = 0; k < dups.length; k++) {
      removeIds.push(dups[k].id);
    }
  }

  if (removeIds.length === 0) {
    return { removedObjections: 0, removedNotes: 0 };
  }

  var removeNoteIds = [];
  for (var p = 0; p < notes.length; p++) {
    if (removeIds.indexOf(notes[p].objection_id) !== -1) {
      removeNoteIds.push(notes[p].id);
    }
  }

  storage.setTable('objection', objections.filter(function (o) {
    return removeIds.indexOf(o.id) === -1;
  }));
  storage.setTable('objection_note', notes.filter(function (n) {
    return removeNoteIds.indexOf(n.id) === -1;
  }));

  return { removedObjections: removeIds.length, removedNotes: removeNoteIds.length };
}

module.exports = { run: run, runObjectionDedup: runObjectionDedup };

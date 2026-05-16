/**
 * customer.repo.js — 客户数据 CRUD
 * 基于 storage.js + id.js，不直接调用 wx.getStorageSync
 */

var storage = require('../storage');
var id = require('../id');
var dateUtil = require('../date');
var policyRepo = require('./policy.repo');
var referralRepo = require('./referral.repo');

/**
 * stage 数字/英文 → 中文映射（防御性兜底）
 * DISABLED: stage-number-mapping — stage 字段直接透传中文字符串，不再做数字/英文映射
 */
/* DISABLED: stage-number-mapping
var _STAGE_MAP = {
  1: '需求沟通',
  2: '已成交',
  3: '已拒绝',
  'need': '需求沟通',
  'touch': '初步接触',
  'deal': '已成交',
  'reject': '已拒绝'
};
*/

/**
 * 归一化客户数据：stage 字段直接透传字符串
 * DISABLED: stage-number-mapping — 不再做数字/英文到中文的映射
 * @param {Object} raw - 原始客户数据
 * @returns {Object} 归一化后的客户数据
 */
function _normalizeCustomer(raw) {
  if (!raw) return raw;
  /* DISABLED: stage-number-mapping
  var stage = raw.stage;
  if (typeof stage === 'number' || (typeof stage === 'string' && _STAGE_MAP[stage])) {
    raw.stage = _STAGE_MAP[stage];
  }
  */
  return raw;
}

/**
 * 查询客户列表，支持筛选和搜索
 * @param {Object} [filters] - 筛选条件
 * @param {string} [filters.keyword] - 姓名关键词模糊匹配
 * @param {string} [filters.stage] - 跟进阶段筛选（'全部'不过滤）
 * @returns {Array<Object>} 客户列表
 */
function list(filters) {
  filters = filters || {};
  var all = storage.getTable('customer');

  var normalized = all.map(_normalizeCustomer);

  return normalized
    .filter(function (c) {
      if (filters.keyword) {
        if ((c.name || '').indexOf(filters.keyword) === -1) return false;
      }
      if (filters.stage && filters.stage !== '全部') {
        if (c.stage !== filters.stage) return false;
      }
      return true;
    })
    .sort(function (a, b) {
      // 最近拜访日期降序，未拜访排后面
      var aVisit = a.last_visit || '';
      var bVisit = b.last_visit || '';
      if (aVisit !== bVisit) return bVisit.localeCompare(aVisit);
      return (b.created_at || '').localeCompare(a.created_at || '');
    });
}

/**
 * 根据 ID 获取单个客户
 * @param {number} id - 客户 ID
 * @returns {Object|null} 客户数据或 null
 */
function get(id) {
  var all = storage.getTable('customer');
  for (var i = 0; i < all.length; i++) {
    if (all[i].id === id) return _normalizeCustomer(all[i]);
  }
  return null;
}

/**
 * 根据手机号查找客户（用于 CSV 导入去重）
 * @param {string} phone
 * @returns {Object|null}
 */
function findByPhone(phone) {
  if (!phone) return null;
  var all = storage.getTable('customer');
  for (var i = 0; i < all.length; i++) {
    if (all[i].phone === phone) return _normalizeCustomer(all[i]);
  }
  return null;
}

/**
 * 根据 ID 查找客户（get 的别名，供导出模块使用）
 * @param {number} customerId
 * @returns {Object|null}
 */
function findById(customerId) {
  return get(customerId);
}

/**
 * 新建客户
 * @param {Object} data - 客户数据
 * @param {string} data.name - 客户姓名（必填）
 * @returns {Object} 执行结果，含 id
 */
function create(data) {
  var all = storage.getTable('customer');
  var newId = id.nextId('customer');
  var now = dateUtil.nowISO();

  var customer = {
    id: newId,
    external_key: data.external_key || null,
    name: data.name || '',
    phone: data.phone || '',
    gender: data.gender || '',
    relation: data.relation || '',
    income: data.income || '',
    age_range: data.age_range || '',
    occupation: data.occupation || '',
    residence: data.residence || '',
    marital: data.marital || '',
    intimacy: data.intimacy || '',
    stage: data.stage || '需求沟通',
    stage_updated_at: data.stage_updated_at || null,
    tags: data.tags || [],
    coverage_needs: data.coverage_needs || {},
    coverage_status: data.coverage_status || {
      重疾: 'unknown', 医疗: 'unknown', 教育金: 'unknown',
      养老: 'unknown', 意外: 'unknown', 寿险: 'unknown'
    },
    is_hnw: data.is_hnw || false,
    referral_count: data.referral_count || 0,
    birthday: data.birthday || null,
    policy_expire_date: data.policy_expire_date || null,
    /* DISABLED: field-removed - 暂时禁用，保留备用
    follow_date: data.follow_date || null,
    todo_task: data.todo_task || '',
    objection_legacy: data.objection_legacy || '',
    apple_rank_overridden: data.apple_rank_overridden || 0,
    */
    family: data.family || '',
    has_need: data.has_need || '不确定',
    has_ability: data.has_ability || '不确定',
    is_decider: data.is_decider || '不确定',
    coverage_gap: data.coverage_gap || '',
    /* DISABLED: field-removed - 暂时禁用，保留备用
    coverage: data.coverage || [],
    gap: data.gap || [],
    */
    last_visit: data.last_visit || null,
    visit_count: data.visit_count || 0,
    created_at: now,
    updated_at: now
  };

  all.push(customer);
  storage.setTable('customer', all);

  // 自动创建默认本人保障对象（require 放在函数内避免循环依赖）
  var insuredMemberRepo = require('./insured-member.repo');
  insuredMemberRepo.create({
    customer_id: newId,
    relation: '本人',
    display_name: customer.name || '本人',
    is_default: true
  });

  return { id: newId };
}

/**
 * 更新客户信息
 * - 若 stage 字段变化，同步更新 stage_updated_at
 * - 自动更新 updated_at
 *
 * @param {number} id - 客户 ID
 * @param {Object} data - 要更新的字段
 * @returns {boolean} 是否成功
 */
function update(id, data) {
  var all = storage.getTable('customer');
  var found = false;

  for (var i = 0; i < all.length; i++) {
    if (all[i].id === id) {
      // stage 字段直接透传（不再做数字/英文映射）
      /* DISABLED: stage-number-mapping
      if (data.stage) {
        data.stage = _STAGE_MAP[data.stage] || data.stage;
      }
      */
      // 检测 stage 是否变化
      if (data.stage && data.stage !== all[i].stage) {
        data.stage_updated_at = dateUtil.nowISO();
      }

      // coverage_status 中 configured 态不可手动设置（由系统通过保单写入）
      if (data.coverage_status) {
        var existing = all[i].coverage_status || {};
        var incoming = data.coverage_status;
        var merged = {};
        var types = ['重疾', '医疗', '教育金', '养老', '意外', '寿险'];
        for (var t = 0; t < types.length; t++) {
          var type = types[t];
          if (incoming[type] !== undefined) {
            // 若当前为 configured，只允许系统通过 _forceStatus 标记覆盖
            if (existing[type] === 'configured' && !data._forceStatus) {
              merged[type] = 'configured';
            } else {
              merged[type] = incoming[type];
            }
          } else {
            merged[type] = existing[type] || 'unknown';
          }
        }
        data.coverage_status = merged;
        delete data._forceStatus;
      }

      // 合并更新字段
      for (var key in data) {
        if (data[key] !== undefined) {
          all[i][key] = data[key];
        }
      }
      all[i].updated_at = dateUtil.nowISO();
      found = true;
      break;
    }
  }

  if (found) {
    storage.setTable('customer', all);
  }
  return found;
}

/**
 * 删除客户（级联清理关联的拜访计划、拜访记录和异议数据）
 * @param {number} id - 客户 ID
 * @returns {boolean} 是否成功
 */
function deleteCustomer(id) {
  var all = storage.getTable('customer');
  var originalLen = all.length;
  var filtered = all.filter(function (c) { return c.id !== id; });
  if (filtered.length < originalLen) {
    storage.setTable('customer', filtered);

    // 级联删除关联的拜访计划
    var plans = storage.getTable('plan');
    var remainingPlans = plans.filter(function (p) { return p.customer_id !== id; });
    if (remainingPlans.length < plans.length) {
      storage.setTable('plan', remainingPlans);
    }

    // 级联删除关联的拜访记录
    var records = storage.getTable('visit_record');
    var remainingRecords = records.filter(function (r) { return r.customer_id !== id; });
    if (remainingRecords.length < records.length) {
      storage.setTable('visit_record', remainingRecords);
    }

    // 级联删除异议相关数据
    var objNotes = storage.getTable('objection_note');
    var customerNotes = objNotes.filter(function (n) { return n.customer_id === id; });

    // 统计需要从 objection_links 中移除的预置异议条目数
    var presetRemoveCount = {};
    customerNotes.forEach(function (n) {
      if (typeof n.objection_id === 'string' && n.objection_id.indexOf('preset_') === 0) {
        presetRemoveCount[n.objection_id] = (presetRemoveCount[n.objection_id] || 0) + 1;
      }
    });

    // 从 objection_links 中移除对应条目
    if (Object.keys(presetRemoveCount).length > 0) {
      var links = storage.getTable('objection_links');
      var removedCount = {};
      var remainingLinks = links.filter(function (l) {
        var pid = l.presetId;
        if (presetRemoveCount[pid] && (removedCount[pid] || 0) < presetRemoveCount[pid]) {
          removedCount[pid] = (removedCount[pid] || 0) + 1;
          return false;
        }
        return true;
      });
      storage.setTable('objection_links', remainingLinks);
    }

    // 删除该客户的 objection_note 行
    var remainingNotes = objNotes.filter(function (n) { return n.customer_id !== id; });
    if (remainingNotes.length < objNotes.length) {
      storage.setTable('objection_note', remainingNotes);
    }

    // 对自建异议（数字 ID）减少出现次数，并删除该客户自建的异议行
    var customObjDecrements = {};
    customerNotes.forEach(function (n) {
      if (typeof n.objection_id === 'number') {
        customObjDecrements[n.objection_id] = (customObjDecrements[n.objection_id] || 0) + 1;
      }
    });
    var objections = storage.getTable('objection');
    var needObjWrite = false;
    var remainingObjections = objections.filter(function (o) {
      if (o.customer_id === id) { needObjWrite = true; return false; }
      if (customObjDecrements[o.id] !== undefined) {
        o.count = Math.max(0, (o.count || 0) - customObjDecrements[o.id]);
        needObjWrite = true;
      }
      return true;
    });
    if (needObjWrite) {
      storage.setTable('objection', remainingObjections);
    }

    // 级联删除转介绍关系
    // 1. 删除该客户的入边（谁介绍了他），并重算介绍人的 referral_count
    var removedReferrerId = referralRepo.removeByReferredCustomer(id);
    if (removedReferrerId !== null) {
      referralRepo.recountReferralCount(removedReferrerId);
    }
    // 2. 删除该客户的出边（他介绍了谁），被介绍人变为无来源
    referralRepo.removeByReferrer(id);

    return true;
  }
  return false;
}

/**
 * 获取单个客户并附加派生字段（policy_count / total_premium / avg_premium / first_policy_date）
 * 所有需要展示保单价值的页面必须通过此方法，禁止自行聚合
 * @param {number} customerId
 * @returns {Object|null} 含派生字段的客户对象，或 null
 */
function getCustomerWithDerived(customerId) {
  var customer = get(customerId);
  if (!customer) return null;
  var derived = policyRepo.getDerived(customerId);
  return Object.assign({}, customer, derived);
}

/**
 * 获取客户总量
 * @returns {number} 客户总数
 */
function count() {
  if (!storage.isReady()) return 0;
  return storage.getTable('customer').length;
}

/**
 * 新建客户并同时建立转介绍关系（原子操作）
 * @param {Object} data - 客户数据
 * @param {number|null} referrerCustomerId - 介绍人客户 ID，无则传 null
 * @returns {{ id: number }}
 */
function createWithReferral(data, referrerCustomerId) {
  var result = create(data);
  if (referrerCustomerId !== null && referrerCustomerId !== undefined) {
    referralRepo.createRelation(referrerCustomerId, result.id, { source: 'customer_create' });
    referralRepo.recountReferralCount(referrerCustomerId);
  }
  return result;
}

/**
 * 更新客户的转介绍来源（介绍人）
 * - newReferrerId 为 null：删除现有介绍关系
 * - 已有关系：更新介绍人
 * - 无关系：新建介绍关系
 * @param {number} customerId - 被介绍客户 ID
 * @param {number|null} newReferrerId - 新介绍人 ID，null 表示清除
 * @returns {{ ok: boolean, error?: string }}
 */
function updateReferralSource(customerId, newReferrerId) {
  try {
    var existing = referralRepo.getByReferred(customerId);
    var oldReferrerId = existing ? existing.referrer_customer_id : null;

    if (newReferrerId === null || newReferrerId === undefined) {
      if (existing) {
        referralRepo.removeByReferredCustomer(customerId);
        referralRepo.recountReferralCount(oldReferrerId);
      }
    } else if (existing) {
      referralRepo.updateRelation(customerId, newReferrerId);
      if (oldReferrerId !== newReferrerId) {
        referralRepo.recountReferralCount(oldReferrerId);
        referralRepo.recountReferralCount(newReferrerId);
      }
    } else {
      referralRepo.createRelation(newReferrerId, customerId, { source: 'customer_edit' });
      referralRepo.recountReferralCount(newReferrerId);
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || '转介绍来源更新失败' };
  }
}

module.exports = {
  list: list,
  get: get,
  findByPhone: findByPhone,
  findById: findById,
  getCustomerWithDerived: getCustomerWithDerived,
  create: create,
  update: update,
  createWithReferral: createWithReferral,
  updateReferralSource: updateReferralSource,
  delete: deleteCustomer,
  count: count
};

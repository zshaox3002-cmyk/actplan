/**
 * app.js — 应用入口
 * 职责：初始化数据存储、基础库版本检测、Storage 容量预警、云端备份/恢复
 */

var storage = require('./utils/storage');
var cloudSync = require('./utils/cloud-sync');
var toast = require('./utils/toast');
/* DISABLED: seed-dev-tool — 发布时排除 seed.js，开发时取消注释即可恢复
var seed = require('./utils/seed');
*/

/** 最低基础库版本 */
var MIN_SDK_VERSION = '2.10.0';

App({
  globalData: {
    storageReady: false,
    currentPeriod: 'week',
    filters: {
      stage: '全部'
    }
  },

  onLaunch: function () {
    console.log('[App] onLaunch — 开始初始化存储');

    // 1. 基础库版本检测
    this._checkSDKVersion();

    // 2. 初始化本地存储
    storage.init();
    this.globalData.storageReady = true;
    console.log('[App] Storage Ready ✓');

    // 3. 注入云同步模块
    storage.setCloudSync(cloudSync);

    // 3.1 & 3.2 一次性去重历史脏数据
    var meta = storage.getMeta();
    var dedup = require('./utils/dedup-records');

    if (!meta.dedup_v1_done) {
      var dedupResult = dedup.run();
      console.log('[App] 去重完成: 记录 -' + dedupResult.removedRecords + ', 保单 -' + dedupResult.removedPolicies);
      meta.dedup_v1_done = true;
      storage.persistMeta();
    }

    if (!meta.dedup_objection_v1_done) {
      var r2 = dedup.runObjectionDedup();
      console.log('[App] 异议去重完成: 异议 -' + r2.removedObjections + ', 备注 -' + r2.removedNotes);
      meta.dedup_objection_v1_done = true;
      storage.persistMeta();
    }

    // 3.3 清理孤儿计划（customer_id 对应客户不存在的待执行计划）
    if (!meta.cleanup_orphan_plans_v1_done) {
      var plans = storage.getTable('plan');
      var customers = storage.getTable('customer');
      var customerIdSet = {};
      for (var ci = 0; ci < customers.length; ci++) {
        customerIdSet[customers[ci].id] = true;
      }
      var cleanedPlans = plans.filter(function (p) {
        return customerIdSet[p.customer_id] !== undefined;
      });
      var removedCount = plans.length - cleanedPlans.length;
      if (removedCount > 0) {
        storage.setTable('plan', cleanedPlans);
        console.log('[App] 孤儿计划清理完成: 移除 ' + removedCount + ' 条');
      }
      meta.cleanup_orphan_plans_v1_done = true;
      storage.persistMeta();
    }

    // 4. 注册 Storage 容量预警
    var that = this;
    storage.onCapacityWarning(function (level, tableName, kbSize) {
      if (level === 'critical') {
        wx.showModal({
          title: '存储空间不足',
          content: '数据量已达 ' + kbSize + 'KB，建议立即导出数据以防丢失。可在概览页导出数据。',
          showCancel: false,
          confirmText: '知道了'
        });
      } else {
        console.warn('[App] Storage 容量预警: ' + tableName + ' = ' + kbSize + 'KB');
      }
    });

    // 5. 启动时检查一次总容量
    this._checkTotalCapacity();

    // 6. 云开发初始化 + 数据恢复
    this._initCloud();
  },

  onShow: function () {
    // 重试上次失败的云端上传
    if (cloudSync.isReady()) {
      cloudSync.flushDirty(this._getAllTableData);
    }
  },

  onHide: function () {
    // 兜底：用户离开时强制上传所有 dirty 表
    if (cloudSync.isReady()) {
      cloudSync.flushDirty(this._getAllTableData);
    }
  },

  /**
   * 获取所有表的当前数据（供 flushDirty 使用）
   * @returns {Object} { tableName: data }
   * @private
   */
  _getAllTableData: function () {
    var tableNames = ['customer', 'visit_record', 'plan', 'objection',
      'objection_note', 'objection_links', 'operation_log', 'policy', 'segment',
      'insured_member', 'task_dismiss', 'referral_relation'];
    var result = {};
    tableNames.forEach(function (name) {
      result[name] = storage.getTable(name);
    });
    result['_meta'] = storage.getMeta();
    return result;
  },

  /**
   * 初始化云开发，若本地为空则从云端恢复数据
   * @private
   */
  _initCloud: function () {
    var meta = storage.getMeta();
    var restoreStatus = meta.restore_status;
    var isEmpty = storage.getTable('customer').length === 0;

    cloudSync.init().then(function () {
      // 本地有数据且不是待重试状态，静默就绪
      if (!isEmpty && restoreStatus !== 'pending') {
        return;
      }

      // 本地有数据但之前恢复失败过（pending），且用户已录入新数据 → 跳过恢复，不覆盖
      if (!isEmpty && restoreStatus === 'pending') {
        console.log('[App] 本地已有数据，跳过云端恢复，标记 skipped');
        meta.restore_status = 'skipped';
        storage.persistMeta();
        return;
      }

      // 本地为空，标记 pending 后尝试恢复
      meta.restore_status = 'pending';
      storage.persistMeta();

      console.log('[App] 本地数据为空，尝试云端恢复...');
      return cloudSync.restoreAll().then(function (backup) {
        if (!backup) {
          // 云端也没有数据，确认是新用户
          meta.restore_status = 'done';
          storage.persistMeta();
          return;
        }

        var tableNames = ['customer', 'visit_record', 'plan', 'objection',
          'objection_note', 'objection_links', 'operation_log', 'policy', 'segment',
          'insured_member', 'task_dismiss', 'referral_relation'];

        // Disable cloud sync during restore to avoid re-uploading data just downloaded
        storage.setCloudSync(null);
        tableNames.forEach(function (name) {
          if (backup.tables[name] && Array.isArray(backup.tables[name])) {
            storage.setTable(name, backup.tables[name]);
          }
        });
        storage.setCloudSync(cloudSync);

        if (backup.meta) {
          // version 不从云端恢复，防止旧备份的 version 跳过本地迁移
          var localVersion = meta.version;
          Object.assign(meta, backup.meta);
          meta.version = localVersion;
        }
        meta.restore_status = 'done';
        storage.persistMeta();

        console.log('[App] 云端数据恢复完成 ✓');
        wx.showToast({ title: '数据已恢复', icon: 'success', duration: 1500 });
        setTimeout(function () {
          wx.reLaunch({ url: '/pages/dashboard/index' });
        }, 1600);
      }).catch(function (e) {
        // 本地为空 + 恢复失败，提示用户，保留 pending 状态下次重试
        console.warn('[App] 云端恢复失败，下次启动重试:', e);
        wx.showModal({
          title: '数据恢复失败',
          content: '云端数据拉取失败，请检查网络后重启小程序重试。如继续使用，数据将从空白开始。',
          showCancel: false,
          confirmText: '知道了'
        });
      });
    }).catch(function (e) {
      console.error('[App] 云开发初始化异常:', e);
    });
  },

  /**
   * 基础库版本检测
   * @private
   */
  _checkSDKVersion: function () {
    var sdkVersion = wx.getSystemInfoSync().SDKVersion;
    if (this._compareVersion(sdkVersion, MIN_SDK_VERSION) < 0) {
      wx.showModal({
        title: '微信版本过低',
        content: '当前微信基础库版本 ' + sdkVersion + '，最低要求 ' + MIN_SDK_VERSION + '。请升级微信后重试。',
        showCancel: false,
        confirmText: '知道了'
      });
    }
  },

  /**
   * 比较版本号
   * @returns {number} 1(a>b) / 0(a=b) / -1(a<b)
   * @private
   */
  _compareVersion: function (a, b) {
    var pa = a.split('.');
    var pb = b.split('.');
    for (var i = 0; i < Math.max(pa.length, pb.length); i++) {
      var na = parseInt(pa[i] || '0', 10);
      var nb = parseInt(pb[i] || '0', 10);
      if (na > nb) return 1;
      if (na < nb) return -1;
    }
    return 0;
  },

  /**
   * 检查总存储容量
   * @private
   */
  _checkTotalCapacity: function () {
    try {
      var res = wx.getStorageInfoSync();
      var usedKB = (res.currentSize || 0);
      var limitKB = (res.limitSize || 10240);

      if (usedKB > limitKB * 0.9) {
        wx.showModal({
          title: '存储空间不足',
          content: '已使用 ' + usedKB + 'KB / ' + limitKB + 'KB，建议导出数据后清理。',
          showCancel: false,
          confirmText: '知道了'
        });
      } else if (usedKB > limitKB * 0.7) {
        console.warn('[App] Storage 使用率较高: ' + usedKB + 'KB / ' + limitKB + 'KB');
      }
    } catch (e) {
      console.error('[App] 获取存储信息失败:', e);
    }
  },

  /* DISABLED: seed-dev-tool — 发布时排除，开发调试时取消注释
  // 灌入测试数据（Console 调用：getApp().seedRun()）
  seedRun: function () {
    return seed.run();
  },

  // 清除所有业务数据（Console 调用：getApp().seedClear()）
  seedClear: function () {
    return seed.clear();
  }
  */
});

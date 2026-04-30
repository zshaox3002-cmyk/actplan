/**
 * app.js — 应用入口
 * 职责：初始化数据存储、基础库版本检测、Storage 容量预警
 */

var storage = require('./utils/storage');
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

    // 2. 初始化存储
    storage.init();
    this.globalData.storageReady = true;
    console.log('[App] Storage Ready ✓');

    // 3. 注册 Storage 容量预警
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

    // 4. 启动时检查一次总容量
    this._checkTotalCapacity();
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

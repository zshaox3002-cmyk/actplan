var customerImport = require('../../utils/data-io/customer-import');
var customerExport = require('../../utils/data-io/customer-export');
var customerRepo = require('../../utils/repository/customer.repo');
var referralRepo = require('../../utils/repository/referral.repo');
var storage = require('../../utils/storage');

Page({
  data: {
    step: 'idle',
    loading: false,
    preview: null,
    importResult: null,
    missingReferrerCustomers: []
  },

  onShow: function () {
    var that = this;
    if (storage.isReady()) {
      that._loadMissingReferrers();
    } else {
      storage.waitReady().then(function () { that._loadMissingReferrers(); });
    }
  },

  /**
   * 计算关系来源为「客户介绍」但未填写介绍人的客户列表
   */
  _loadMissingReferrers: function () {
    var all = customerRepo.list();
    var missing = [];
    for (var i = 0; i < all.length; i++) {
      var c = all[i];
      if (c.relation === '客户介绍' && !referralRepo.getByReferred(c.id)) {
        missing.push({ id: c.id, name: c.name });
      }
    }
    this.setData({ missingReferrerCustomers: missing });
  },

  /**
   * 点击缺失介绍人的客户名，跳转到详情页补填
   * @param {Object} e
   */
  onMissingReferrerTap: function (e) {
    var id = parseInt(e.currentTarget.dataset.id);
    wx.navigateTo({ url: '/pages/customer-detail/index?id=' + id });
  },

  downloadTemplate: function () {
    var filePath = wx.env.USER_DATA_PATH + '/actplan_customer_template.xlsx';
    try {
      var xlsxData = customerExport.buildTemplateXlsx();
      wx.getFileSystemManager().writeFileSync(filePath, xlsxData.buffer);
    } catch (e) {
      console.error('template write fail', e);
      wx.showToast({ title: '模板生成失败', icon: 'none' });
      return;
    }
    wx.shareFileMessage({
      filePath: filePath,
      fail: function (err) {
        if (err && err.errMsg && err.errMsg.indexOf('canceled') !== -1) return;
        console.error('shareFileMessage fail', JSON.stringify(err));
        wx.showToast({ title: err.errMsg || '分享失败', icon: 'none', duration: 3000 });
      }
    });
  },

  startImport: function () {
    var self = this;
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      success: function (res) {
        var file = res.tempFiles[0];
        if (!file.name.endsWith('.xlsx')) {
          wx.showToast({ title: '请选择 xlsx 文件', icon: 'none' });
          return;
        }
        self.setData({ loading: true });
        wx.getFileSystemManager().readFile({
          filePath: file.path,
          success: function (fileRes) {
            var previewResult = customerImport.previewXlsx(fileRes.data);
            self.setData({
              loading: false,
              step: 'preview_done',
              preview: previewResult
            });
          },
          fail: function () {
            self.setData({ loading: false });
            wx.showToast({ title: '文件读取失败', icon: 'none' });
          }
        });
      }
    });
  },

  cancelImport: function () {
    this.setData({ step: 'idle', preview: null });
  },

  confirmImport: function () {
    var self = this;
    var plan = this.data.preview && this.data.preview.plan;
    if (!plan) return;
    self.setData({ loading: true });
    try {
      var result = customerImport.commit(plan);
      self.setData({
        loading: false,
        step: 'done',
        importResult: result
      });
    } catch (e) {
      self.setData({ loading: false });
      wx.showModal({
        title: '导入失败',
        content: e.message || '未知错误',
        showCancel: false
      });
    }
  },

  resetImport: function () {
    this.setData({ step: 'idle', preview: null, importResult: null });
  },

  exportCustomers: function () {
    var self = this;
    self.setData({ loading: true });
    var xlsxData = customerExport.exportCustomersXlsx();
    var date = new Date().toISOString().slice(0, 10);
    var filePath = wx.env.USER_DATA_PATH + '/actplan_customers_' + date + '.xlsx';
    try {
      wx.getFileSystemManager().writeFileSync(filePath, xlsxData.buffer);
    } catch (e) {
      self.setData({ loading: false });
      console.error('export write fail', e);
      wx.showToast({ title: '导出失败', icon: 'none' });
      return;
    }
    self.setData({ loading: false });
    wx.shareFileMessage({
      filePath: filePath,
      fail: function (err) {
        if (err && err.errMsg && err.errMsg.indexOf('canceled') !== -1) return;
        console.error('shareFileMessage fail', JSON.stringify(err));
        wx.showToast({ title: err.errMsg || '分享失败', icon: 'none', duration: 3000 });
      }
    });
  }
});

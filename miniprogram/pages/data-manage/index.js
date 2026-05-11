const { importCustomersFromCSV, importRecordsFromCSV, importPoliciesFromCSV } = require('../../utils/import-service')
const { exportCustomers, exportRecords, exportPolicies } = require('../../utils/export-service')
const { buildCustomerTemplateCSV, buildRecordTemplateCSV, buildPolicyTemplateCSV } = require('../../utils/csv-builder')

Page({
  data: {
    importing: false,
    exporting: false
  },

  _importCSV: function (importFn, label) {
    const self = this
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      success: function (res) {
        const file = res.tempFiles[0]
        if (!file.name.endsWith('.csv')) {
          wx.showToast({ title: '请选择CSV文件', icon: 'none' })
          return
        }
        self.setData({ importing: true })
        wx.getFileSystemManager().readFile({
          filePath: file.path,
          encoding: 'utf8',
          success: function (fileRes) {
            const result = importFn(fileRes.data)
            self.setData({ importing: false })
            if (result.success) {
              const skipped = result.skippedCount ? ('，跳过' + result.skippedCount + '条') : ''
              wx.showToast({
                title: label + '成功：' + result.importedCount + '条' + skipped,
                icon: 'success',
                duration: 2500
              })
            } else {
              wx.showModal({
                title: '导入失败',
                content: (result.errors || []).slice(0, 3).join('\n'),
                showCancel: false
              })
            }
          },
          fail: function () {
            self.setData({ importing: false })
            wx.showToast({ title: '文件读取失败', icon: 'none' })
          }
        })
      }
    })
  },

  _exportCSV: function (exportFn, fileName) {
    const self = this
    self.setData({ exporting: true })
    const csv = exportFn()
    const filePath = wx.env.USER_DATA_PATH + '/' + fileName
    wx.getFileSystemManager().writeFile({
      filePath: filePath,
      data: '﻿' + csv,
      encoding: 'utf8',
      success: function () {
        self.setData({ exporting: false })
        wx.shareFileMessage({
          filePath: filePath,
          success: function () {},
          fail: function () {
            wx.showToast({ title: '导出完成，分享失败', icon: 'none' })
          }
        })
      },
      fail: function () {
        self.setData({ exporting: false })
        wx.showToast({ title: '导出失败', icon: 'none' })
      }
    })
  },

  _downloadTemplate: function (buildFn, fileName) {
    const csv = buildFn()
    const filePath = wx.env.USER_DATA_PATH + '/' + fileName
    wx.getFileSystemManager().writeFile({
      filePath: filePath,
      data: '﻿' + csv,
      encoding: 'utf8',
      success: function () {
        wx.shareFileMessage({
          filePath: filePath,
          success: function () {},
          fail: function () {
            wx.showToast({ title: '模版已生成，分享失败', icon: 'none' })
          }
        })
      },
      fail: function () {
        wx.showToast({ title: '模版生成失败', icon: 'none' })
      }
    })
  },

  importCustomers: function () {
    this._importCSV(importCustomersFromCSV, '客户')
  },

  importRecords: function () {
    this._importCSV(importRecordsFromCSV, '拜访记录')
  },

  importPolicies: function () {
    this._importCSV(importPoliciesFromCSV, '保单')
  },

  exportCustomers: function () {
    const date = new Date().toISOString().slice(0, 10)
    this._exportCSV(exportCustomers, 'customers_' + date + '.csv')
  },

  exportRecords: function () {
    const date = new Date().toISOString().slice(0, 10)
    this._exportCSV(exportRecords, 'records_' + date + '.csv')
  },

  exportPolicies: function () {
    const date = new Date().toISOString().slice(0, 10)
    this._exportCSV(exportPolicies, 'policies_' + date + '.csv')
  },

  downloadCustomerTemplate: function () {
    this._downloadTemplate(buildCustomerTemplateCSV, 'customer_template.csv')
  },

  downloadRecordTemplate: function () {
    this._downloadTemplate(buildRecordTemplateCSV, 'record_template.csv')
  },

  downloadPolicyTemplate: function () {
    this._downloadTemplate(buildPolicyTemplateCSV, 'policy_template.csv')
  }
})

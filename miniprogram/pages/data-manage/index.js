const { importCustomersFromCSV, importRecordsFromCSV } = require('../../utils/import-service')
const { exportCustomers, exportRecords } = require('../../utils/export-service')
const storage = require('../../utils/storage')

Page({
  data: {
    importType: 'customer',
    importStatus: 'idle', // idle | validating | error | success
    importErrors: [],
    importWarnings: [],
    importResult: null,
    exportCustomerCount: 0,
    exportRecordCount: 0,
  },

  onLoad() {
    if (storage.isReady()) {
      this._loadCounts()
    } else {
      storage.waitReady().then(() => this._loadCounts())
    }
  },

  _loadCounts() {
    try {
      const { count: customerRepo } = require('../../utils/repository/customer.repo')
      const { list: recordList } = require('../../utils/repository/record.repo')
      this.setData({
        exportCustomerCount: customerRepo(),
        exportRecordCount: recordList().length,
      })
    } catch (e) {
      // counts are informational only
    }
  },

  switchImportType(e) {
    const type = e.currentTarget.dataset.type
    this.setData({
      importType: type,
      importStatus: 'idle',
      importErrors: [],
      importWarnings: [],
      importResult: null,
    })
  },

  chooseAndImportFile() {
    if (!storage.isReady()) {
      wx.showToast({ title: '存储未就绪，请稍后重试', icon: 'none' })
      return
    }
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['csv'],
      success: (res) => {
        const file = res.tempFiles[0]
        this.setData({ importStatus: 'validating', importErrors: [], importResult: null })
        const fs = wx.getFileSystemManager()
        fs.readFile({
          filePath: file.path,
          encoding: 'utf8',
          success: (r) => this._processCSV(r.data),
          fail: () => {
            this.setData({
              importStatus: 'error',
              importErrors: ['文件读取失败，请检查文件格式'],
            })
          },
        })
      },
      fail: () => {},
    })
  },

  _processCSV(content) {
    const { importType } = this.data
    let result
    if (importType === 'customer') {
      result = importCustomersFromCSV(content)
    } else {
      result = importRecordsFromCSV(content)
    }

    if (!result.success) {
      this.setData({
        importStatus: 'error',
        importErrors: result.errors,
      })
      return
    }

    this.setData({
      importStatus: 'success',
      importResult: result,
      importWarnings: result.warnings || [],
    })
    this._loadCounts()
  },

  exportData(e) {
    if (!storage.isReady()) {
      wx.showToast({ title: '存储未就绪，请稍后重试', icon: 'none' })
      return
    }
    const type = e.currentTarget.dataset.type
    wx.showLoading({ title: '导出中...' })
    try {
      const result = type === 'customer' ? exportCustomers() : exportRecords()
      wx.hideLoading()
      this._saveFile(result.content, result.filename)
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '导出失败', icon: 'none' })
    }
  },

  _saveFile(content, filename) {
    const fs = wx.getFileSystemManager()
    const filePath = `${wx.env.USER_DATA_PATH}/${filename}`
    fs.writeFile({
      filePath,
      data: content,
      encoding: 'utf8',
      success: () => this._shareFile(filePath, filename),
      fail: () => wx.showToast({ title: '文件保存失败', icon: 'none' }),
    })
  },

  _shareFile(filePath, filename) {
    wx.shareFileMessage({
      filePath,
      fileName: filename,
      fail: () => {
        wx.openDocument({
          filePath,
          showMenu: true,
          fail: () => wx.showToast({ title: '无法打开文件', icon: 'none' }),
        })
      },
    })
  },
})

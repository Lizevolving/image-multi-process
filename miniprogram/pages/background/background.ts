// background.ts
// 导入背景去除服务
import { removeBackground, getAPIQuota, checkAPIQuota } from '../../services/backgroundService';

Page({
  data: {
    imageUrl: '',
    resultImageUrl: '',
    isProcessing: false,
    quotaInfo: null,
    canUseAPI: true
  },

  onLoad() {
    console.log('抠图去背景页面加载')
    this.updateQuotaInfo()
  },

  onShow() {
    // 每次显示页面时更新配额信息
    this.updateQuotaInfo()
  },

  // 更新API使用配额信息
  updateQuotaInfo() {
    const quotaInfo = getAPIQuota()
    const canUseAPI = checkAPIQuota()
    
    this.setData({
      quotaInfo,
      canUseAPI
    })
  },

  // 选择图片
  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      camera: 'back',
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath
        
        // 获取图片信息
        wx.getImageInfo({
          src: tempFilePath,
          success: (imageInfo) => {
            this.setData({
              imageUrl: tempFilePath,
              resultImageUrl: '',
            })
          },
          fail: (err) => {
            console.error('获取图片信息失败', err)
            wx.showToast({
              title: '获取图片信息失败',
              icon: 'none'
            })
          }
        })
      },
      fail: (err) => {
        console.error('选择图片失败', err)
      }
    })
  },

  // 抠图去背景
  removeBackground() {
    if (!this.data.imageUrl) {
      wx.showToast({
        title: '请先选择图片',
        icon: 'none'
      })
      return
    }

    // 检查API配额
    if (!this.data.canUseAPI) {
      wx.showModal({
        title: 'API调用限制',
        content: '今日API调用次数已达上限，请明天再试',
        showCancel: false
      })
      return
    }

    this.setData({
      isProcessing: true
    })

    // 提示用户正在处理中
    wx.showLoading({
      title: '正在处理中...',
      mask: true
    })

    // 使用API去除背景
    removeBackground(this.data.imageUrl)
      .then(resultImagePath => {
        this.setData({
          resultImageUrl: resultImagePath,
          isProcessing: false
        })
        
        // 更新配额信息
        this.updateQuotaInfo()
        
        wx.hideLoading()
        
        wx.showToast({
          title: '抠图完成',
          icon: 'success'
        })
      })
      .catch(error => {
        console.error('抠图失败:', error)
        this.setData({
          isProcessing: false
        })
        
        // 更新配额信息
        this.updateQuotaInfo()
        
        wx.hideLoading()
        
        wx.showModal({
          title: '处理失败',
          content: error.message || '图片处理失败，请稍后再试',
          showCancel: false
        })
      })
  },

  // 保存处理后的图片
  saveImage() {
    if (!this.data.resultImageUrl) {
      wx.showToast({
        title: '请先处理图片',
        icon: 'none'
      })
      return
    }

    wx.saveImageToPhotosAlbum({
      filePath: this.data.resultImageUrl,
      success: () => {
        wx.showToast({
          title: '保存成功',
          icon: 'success'
        })
      },
      fail: (err) => {
        console.error('保存图片失败', err)
        
        if (err.errMsg.indexOf('auth deny') >= 0) {
          wx.showModal({
            title: '提示',
            content: '需要您授权保存图片到相册',
            confirmText: '去授权',
            success: (res) => {
              if (res.confirm) {
                wx.openSetting({
                  success: (settingRes) => {
                    if (settingRes.authSetting['scope.writePhotosAlbum']) {
                      this.saveImage() // 重新尝试保存
                    } else {
                      wx.showToast({
                        title: '授权失败',
                        icon: 'none'
                      })
                    }
                  }
                })
              }
            }
          })
        } else {
          wx.showToast({
            title: '保存失败',
            icon: 'error'
          })
        }
      }
    })
  },

  // 预览处理后的图片
  previewImage() {
    if (this.data.resultImageUrl) {
      wx.previewImage({
        urls: [this.data.resultImageUrl],
        current: this.data.resultImageUrl
      })
    }
  },
  
  // 跳转到服务器说明 - 简化展示内容
  goToServer() {
    wx.showModal({
      title: '功能说明',
      content: '本功能用于快速去除图片背景，每日可使用' + this.data.quotaInfo.total + '次，今日已使用' + this.data.quotaInfo.used + '次',
      showCancel: false
    })
  }
}) 
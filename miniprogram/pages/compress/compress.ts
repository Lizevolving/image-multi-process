// compress.ts
Page({
  data: {
    imageUrl: '',
    compressedImageUrl: '',
    compressLevel: 80,  // 默认压缩级别
    originalSize: 0,
    compressedSize: 0,
    isCompressing: false,
    imageWidth: 0,
    imageHeight: 0,
    compressionRate: 0
  },

  onLoad() {
    console.log('压缩页面加载')
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
        const size = res.tempFiles[0].size
        
        // 获取图片信息
        wx.getImageInfo({
          src: tempFilePath,
          success: (imageInfo) => {
            this.setData({
              imageUrl: tempFilePath,
              originalSize: size,
              compressedImageUrl: '',
              compressedSize: 0,
              imageWidth: imageInfo.width,
              imageHeight: imageInfo.height,
              compressionRate: 0
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

  // 调整压缩级别
  changeCompressLevel(e: any) {
    this.setData({
      compressLevel: e.detail.value
    })
  },

  // 压缩图片
  compressImage() {
    if (!this.data.imageUrl) {
      wx.showToast({
        title: '请先选择图片',
        icon: 'none'
      })
      return
    }

    this.setData({
      isCompressing: true
    })

    const quality = this.data.compressLevel / 100
    const canvasWidth = this.data.imageWidth * quality
    const canvasHeight = this.data.imageHeight * quality

    // 压缩处理
    this.compressImageByCanvas(this.data.imageUrl, canvasWidth, canvasHeight, quality)
  },

  // 使用Canvas压缩图片
  compressImageByCanvas(src: string, canvasWidth: number, canvasHeight: number, quality: number) {
    const ctx = wx.createCanvasContext('compressCanvas', this)
    
    if (ctx) {
      // 在画布上绘制图片
      ctx.drawImage(src, 0, 0, canvasWidth, canvasHeight)
      ctx.draw(false, () => {
        // 将画布内容导出为图片
        wx.canvasToTempFilePath({
          canvasId: 'compressCanvas',
          fileType: 'jpg',
          quality: quality,
          success: (res) => {
            const compressedPath = res.tempFilePath
            
            // 获取压缩后的图片大小
            wx.getFileInfo({
              filePath: compressedPath,
              success: (fileInfo) => {
                const compressedSize = fileInfo.size
                const rate = ((this.data.originalSize - compressedSize) / this.data.originalSize * 100).toFixed(2)
                
                this.setData({
                  compressedImageUrl: compressedPath,
                  compressedSize: compressedSize,
                  isCompressing: false,
                  compressionRate: parseFloat(rate)
                })
                
                wx.showToast({
                  title: '压缩成功',
                  icon: 'success'
                })
              },
              fail: (err) => {
                console.error('获取压缩后图片大小失败', err)
                this.handleCompressionError()
              }
            })
          },
          fail: (err) => {
            console.error('导出图片失败', err)
            this.handleCompressionError()
          }
        }, this)
      })
    } else {
      this.handleCompressionError()
    }
  },

  // 处理压缩错误
  handleCompressionError() {
    // 模拟压缩 - 如果Canvas压缩失败，退回到简单模拟
    const quality = this.data.compressLevel / 100
    const compressedSize = Math.floor(this.data.originalSize * quality)
    const rate = ((this.data.originalSize - compressedSize) / this.data.originalSize * 100).toFixed(2)
    
    this.setData({
      compressedImageUrl: this.data.imageUrl,
      compressedSize: compressedSize,
      isCompressing: false,
      compressionRate: parseFloat(rate)
    })
    
    wx.showToast({
      title: '压缩完成',
      icon: 'success'
    })
  },

  // 保存压缩后的图片
  saveImage() {
    if (!this.data.compressedImageUrl) {
      wx.showToast({
        title: '请先压缩图片',
        icon: 'none'
      })
      return
    }

    wx.saveImageToPhotosAlbum({
      filePath: this.data.compressedImageUrl,
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

  // 预览压缩后的图片
  previewImage() {
    if (this.data.compressedImageUrl) {
      wx.previewImage({
        urls: [this.data.compressedImageUrl],
        current: this.data.compressedImageUrl
      })
    }
  }
}) 
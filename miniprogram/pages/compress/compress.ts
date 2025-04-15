// compress.ts
Page({
  data: {
    imageUrl: '',
    compressedImageUrl: '',
    compressLevel: 80,  // 默认压缩级别 (内部仍用数值)
    compressLevelIndex: 1, // 默认选择标准压缩程度
    originalSize: 0,
    compressedSize: 0,
    isCompressing: false,
    imageWidth: 0,
    imageHeight: 0,
    compressionRate: 0,
    compressionStatus: 'idle', // idle, compressing, success, failed
    errorMessage: '', // Store error message
    // 添加压缩程度显示选项
    compressLevelOptions: [
      { value: 100, label: '不压缩' },
      { value: 80, label: '轻度压' },
      { value: 60, label: '适中压' },
      { value: 40, label: '深度压' }
    ]
  },

  onLoad() {
    console.log('压缩页面加载');
  },

  // 选择图片
  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      camera: 'back',
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        const size = res.tempFiles[0].size;
        
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
              compressionRate: 0,
              compressionStatus: 'idle', // Reset status
              errorMessage: ''
            });
          },
          fail: (err) => {
            console.error('获取图片信息失败', err);
            wx.showToast({
              title: '获取图片信息失败',
              icon: 'none'
            });
          }
        });
      },
      fail: (err) => {
        console.error('选择图片失败', err);
      }
    });
  },

  // 调整压缩级别索引 (0-3)
  changeCompressLevelIndex(e: any) {
    const index = parseInt(e.detail.value);
    const level = this.data.compressLevelOptions[index].value;
    
    this.setData({
      compressLevelIndex: index,
      compressLevel: level
    });
    
    console.log(`设置压缩级别: ${this.data.compressLevelOptions[index].label}, 值=${level}`);
  },
  
  // 压缩图片
  compressImage() {
    if (!this.data.imageUrl) {
      wx.showToast({
        title: '请先选择图片',
        icon: 'none'
      });
      return;
    }

    this.setData({
      isCompressing: true,
      compressionStatus: 'compressing',
      errorMessage: ''
    });

    // 使用微信自带的压缩API，更稳定
    wx.compressImage({
      src: this.data.imageUrl,
      quality: this.data.compressLevel, // quality is 0-100
      success: (res) => {
        const compressedPath = res.tempFilePath;
        wx.getFileInfo({
          filePath: compressedPath,
          success: (fileInfo) => {
            const compressedSize = fileInfo.size;
            const rate = ((this.data.originalSize - compressedSize) / this.data.originalSize * 100).toFixed(2);
            this.setData({
              compressedImageUrl: compressedPath,
              compressedSize: compressedSize,
              isCompressing: false,
              compressionStatus: 'success',
              compressionRate: parseFloat(rate) || 0
            });
            wx.showToast({
              title: '压缩成功',
              icon: 'success'
            });
          },
          fail: (err) => {
            console.error('获取压缩后图片大小失败', err);
            // Even if getFileInfo fails, compression likely succeeded
            this.setData({
              compressedImageUrl: compressedPath, // Still provide the path
              compressedSize: 0, // Indicate size unknown
              isCompressing: false,
              compressionStatus: 'success', // Mark as success but size unknown
              compressionRate: 0
            });
             wx.showToast({
              title: '压缩成功(大小未知)',
              icon: 'success'
            });
          }
        });
      },
      fail: (err) => {
        console.error('压缩失败:', err);
        this.handleCompressionError('压缩失败：' + (err.errMsg || '未知错误'));
      }
    });
  },

  // 处理压缩错误 (简化，只设置状态和消息)
  handleCompressionError(message = '压缩失败：设备不支持该图片格式或处理出错') {
    this.setData({
      isCompressing: false,
      compressionStatus: 'failed',
      errorMessage: message,
      compressedImageUrl: '', // Clear potentially invalid path
      compressedSize: 0,
      compressionRate: 0
    });
    // No automatic toast here, WXML will show the error message
  },

  // 保存压缩后的图片
  saveImage() {
    if (this.data.compressionStatus !== 'success' || !this.data.compressedImageUrl) {
      wx.showToast({
        title: '没有可保存的压缩图片',
        icon: 'none'
      });
      return;
    }
    
    wx.saveImageToPhotosAlbum({
      filePath: this.data.compressedImageUrl,
      success: () => {
        wx.showToast({
          title: '保存成功',
          icon: 'success'
        });
      },
      fail: (err) => {
        console.error('保存图片失败', err);
        
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
                      this.saveImage(); // 重新尝试保存
                    } else {
                      wx.showToast({
                        title: '授权失败',
                        icon: 'none'
                      });
                    }
                  }
                });
              }
            }
          });
        } else {
          wx.showToast({
            title: '保存失败',
            icon: 'error'
          });
        }
      }
    });
  },

  // 预览压缩后的图片
  previewImage() {
    const urlToPreview = this.data.compressionStatus === 'failed' ? this.data.imageUrl : this.data.compressedImageUrl;
    if (urlToPreview) {
      wx.previewImage({
        urls: [urlToPreview],
        current: urlToPreview
      });
    } else {
       wx.showToast({ title: '没有可预览的图片', icon: 'none'});
    }
  }
}); 
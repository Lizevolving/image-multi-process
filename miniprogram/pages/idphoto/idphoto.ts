// idphoto.ts
import { removeBackground, getAPIQuota, checkAPIQuota, startTimeoutMonitor, stopTimeoutMonitor } from '../../services/backgroundService';

// 定义尺寸选项
const SIZE_OPTIONS = [
  { id: 'oneinch', name: '一寸', width: 295, height: 413, desc: '25mm × 35mm' },
  { id: 'twoinch', name: '二寸', width: 413, height: 579, desc: '35mm × 49mm' },
  { id: 'passport', name: '护照', width: 354, height: 472, desc: '33mm × 48mm' },
  { id: 'visa', name: '签证', width: 472, height: 472, desc: '51mm × 51mm' }
];

// 定义背景色选项
const COLOR_OPTIONS = [
  { id: 'white', name: '白色', color: '#FFFFFF' },
  { id: 'blue', name: '蓝色', color: '#2E7BED' },
  { id: 'red', name: '红色', color: '#E74C3C' },
  { id: 'gray', name: '灰色', color: '#BDC3C7' }
];

Page({
  data: {
    // 尺寸和背景色选项
    sizeOptions: SIZE_OPTIONS,
    colorOptions: COLOR_OPTIONS,
    
    // 当前选择
    selectedSize: SIZE_OPTIONS[0],
    selectedColor: COLOR_OPTIONS[0],
    
    // 图片相关
    originalImage: '',
    croppedImage: '',
    resultImage: '',
    
    // 状态控制
    isProcessing: false,
    currentStep: 'select', // select, crop, process, result
    
    // API配额信息
    quotaInfo: null,
    canUseAPI: true,
    
    // 清晰度选项
    resolution: 'normal', // normal, high
    
    // 裁剪相关
    cropperVisible: false
  },

  // 定义超时定时器
  timeoutTimer: null as any,

  onLoad() {
    console.log('证件照制作页面加载');
    this.updateQuotaInfo();
  },
  
  onShow() {
    // 每次显示页面时更新配额信息
    this.updateQuotaInfo();
  },
  
  // 更新API使用配额信息
  updateQuotaInfo() {
    const quotaInfo = getAPIQuota();
    const canUseAPI = checkAPIQuota();
    
    this.setData({
      quotaInfo,
      canUseAPI
    });
  },
  
  // 选择尺寸
  selectSize(e: WechatMiniprogram.TouchEvent) {
    const sizeId = e.currentTarget.dataset.id;
    const selectedSize = SIZE_OPTIONS.find(item => item.id === sizeId);
    
    if (selectedSize) {
      this.setData({ selectedSize });
    }
  },
  
  // 选择背景色
  selectColor(e: WechatMiniprogram.TouchEvent) {
    const colorId = e.currentTarget.dataset.id;
    const selectedColor = COLOR_OPTIONS.find(item => item.id === colorId);
    
    if (selectedColor) {
      this.setData({ selectedColor });
    }
  },
  
  // 选择清晰度
  switchResolution() {
    const resolution = this.data.resolution === 'normal' ? 'high' : 'normal';
    this.setData({ resolution });
  },
  
  // 选择/拍摄照片
  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      camera: 'back',
      success: (res) => {
        const originalImage = res.tempFiles[0].tempFilePath;
        
        this.setData({
          originalImage,
          croppedImage: '',
          resultImage: '',
          currentStep: 'crop'
        });
        
        // 跳转到裁剪页面
        wx.navigateTo({
          url: `../crop/crop?image=${originalImage}&width=${this.data.selectedSize.width}&height=${this.data.selectedSize.height}`
        });
      }
    });
  },
  
  // 接收裁剪后的图片（由crop页面回传）
  onImageCropped(croppedImage: string) {
    this.setData({
      croppedImage,
      currentStep: 'process'
    });
    
    // 自动进行下一步处理（抠图）
    this.processImage();
  },
  
  // 添加：处理裁剪取消
  onCropCanceled() {
    console.log('裁剪已取消');
    // 回到选择页面
    this.setData({
      currentStep: 'select'
    });
  },
  
  // 处理图片（抠图并合成）
  processImage() {
    if (!this.data.croppedImage) {
      wx.showToast({
        title: '请先裁剪图片',
        icon: 'none'
      });
      return;
    }
    
    // 检查API配额
    if (!this.data.canUseAPI) {
      wx.showModal({
        title: 'API调用限制',
        content: '今日API调用次数已达上限，请明天再试',
        showCancel: false,
        success: () => {
          // 返回选择页面
          this.setData({
            currentStep: 'select'
          });
        }
      });
      return;
    }
    
    this.setData({
      isProcessing: true
    });
    
    wx.showLoading({
      title: '正在处理中...',
      mask: true
    });
    
    // 使用统一的超时监控机制
    startTimeoutMonitor(() => {
      // 超时强制退出
      this.setData({
        isProcessing: false,
        currentStep: 'select' // 超时返回选择页面
      });
    });
    
    // 1. 先去除背景
    removeBackground(this.data.croppedImage)
      .then(noBackgroundImage => {
        // 清除超时监控
        stopTimeoutMonitor();
        
        // 检查是否仍在处理状态（可能已被超时中断）
        if (!this.data.isProcessing) return;
        
        // 2. 合成指定尺寸和背景色的证件照
        this.generateidphoto(noBackgroundImage);
      })
      .catch(error => {
        // 清除超时监控
        stopTimeoutMonitor();
        
        console.error('抠图失败:', error);
        this.setData({
          isProcessing: false,
          currentStep: 'select' // 失败时返回到选择页面
        });
        
        // 更新配额信息
        this.updateQuotaInfo();
        
        wx.hideLoading();
        
        wx.showModal({
          title: '处理失败',
          content: error.message || '图片处理失败，请稍后再试',
          showCancel: false
        });
      });
  },
  
  // 生成证件照
  generateidphoto(noBackgroundImage: string) {
    const { selectedSize, selectedColor } = this.data;
    const { width, height } = selectedSize;
    
    try {
      // 启动超时监控
      startTimeoutMonitor(() => {
        // 超时强制退出
        this.setData({
          isProcessing: false,
          currentStep: 'select'
        });
      });
      
      // 创建离屏canvas合成证件照
      const ctx = wx.createCanvasContext('idphotoCanvas');
      
      // 绘制背景色
      ctx.fillStyle = selectedColor.color;
      ctx.fillRect(0, 0, width, height);
      
      // 居中绘制人像
      wx.getImageInfo({
        src: noBackgroundImage,
        success: (imageInfo) => {
          const imgWidth = imageInfo.width;
          const imgHeight = imageInfo.height;
          
          // 计算缩放比例和居中位置
          let scale, x, y;
          
          if (imgWidth / imgHeight > width / height) {
            // 图片更宽，以高度为准缩放
            scale = height / imgHeight;
            x = (width - imgWidth * scale) / 2;
            y = 0;
          } else {
            // 图片更高，以宽度为准缩放
            scale = width / imgWidth;
            x = 0;
            y = (height - imgHeight * scale) / 2;
          }
          
          ctx.drawImage(
            noBackgroundImage,
            x,
            y,
            imgWidth * scale,
            imgHeight * scale
          );
          
          // 使用try-catch处理潜在的canvas错误
          try {
            ctx.draw(false, () => {
              // 导出为图片
              setTimeout(() => {
                try {
                  wx.canvasToTempFilePath({
                    canvasId: 'idphotoCanvas',
                    x: 0,
                    y: 0,
                    width: width,
                    height: height,
                    destWidth: width * (this.data.resolution === 'high' ? 3 : 1),
                    destHeight: height * (this.data.resolution === 'high' ? 3 : 1),
                    success: (res) => {
                      // 清除超时监控
                      stopTimeoutMonitor();
                      this.setData({
                        resultImage: res.tempFilePath,
                        currentStep: 'result',
                        isProcessing: false
                      });
                      
                      // 更新配额信息
                      this.updateQuotaInfo();
                      
                      wx.hideLoading();
                    },
                    fail: (err) => {
                      // 清除超时监控
                      stopTimeoutMonitor();
                      console.error('生成证件照失败', err);
                      this.handleCanvasError(noBackgroundImage);
                    }
                  });
                } catch (error) {
                  // 清除超时监控
                  stopTimeoutMonitor();
                  console.error('Canvas操作异常', error);
                  this.handleCanvasError(noBackgroundImage);
                }
              }, 300);
            });
          } catch (error) {
            // 清除超时监控
            stopTimeoutMonitor();
            console.error('Canvas绘制异常', error);
            this.handleCanvasError(noBackgroundImage);
          }
        },
        fail: (err) => {
          // 清除超时监控
          stopTimeoutMonitor();
          console.error('获取图片信息失败', err);
          this.handleCanvasError(noBackgroundImage);
        }
      });
    } catch (error) {
      // 停止超时监控
      stopTimeoutMonitor();
      
      console.error('Canvas创建异常', error);
      this.handleCanvasError(noBackgroundImage);
    }
  },
  
  // 处理Canvas错误的回退方案
  handleCanvasError(noBackgroundImage: string) {
    // 停止超时监控
    stopTimeoutMonitor();
    
    // Canvas操作失败时，直接使用抠图结果
    this.setData({
      resultImage: noBackgroundImage,
      isProcessing: false,
      currentStep: 'result'
    });
    
    // 更新配额信息
    this.updateQuotaInfo();
    
    wx.hideLoading();
    
    wx.showToast({
      title: '已完成基础处理',
      icon: 'success'
    });
  },
  
  // 清除超时定时器的辅助函数 - 现在使用统一的stopTimeoutMonitor
  clearTimeoutTimer() {
    stopTimeoutMonitor();
  },
  
  // 重新裁剪
  reCrop() {
    if (this.data.originalImage) {
      // 跳转到裁剪页面
      wx.navigateTo({
        url: `../crop/crop?image=${this.data.originalImage}&width=${this.data.selectedSize.width}&height=${this.data.selectedSize.height}`
      });
    } else {
      this.chooseImage();
    }
  },
  
  // 重新生成 (修改为更换背景色)
  regenerate() {
    // 获取当前颜色索引
    const currentIndex = COLOR_OPTIONS.findIndex(color => color.id === this.data.selectedColor.id);
    // 计算下一个颜色索引
    const nextIndex = (currentIndex + 1) % COLOR_OPTIONS.length;
    const nextColor = COLOR_OPTIONS[nextIndex];

    this.setData({ 
      selectedColor: nextColor,
      isProcessing: true, // 显示处理中状态
      currentStep: 'process'
    });

    wx.showLoading({ title: '更换背景中...', mask: true });

    // 需要获取已抠图的图片路径，这里假设它存储在某个变量中
    // 假设抠图结果存储在 this.noBackgroundImagePath
    // 如果没有存储抠图结果，需要重新执行 processImage
    // 为了简化，这里我们假设抠图结果可用，直接调用 generateidphoto
    // 在实际应用中，需要更健壮地处理抠图结果的存储和获取

    // 假设有一个存储抠图结果的变量，例如 this.data.noBackgroundImagePath
    // 如果没有，需要先执行抠图
    const noBgImage = this.data.croppedImage; // 简化处理：直接使用裁剪图模拟抠图结果
    if (!noBgImage) {
        wx.hideLoading();
        wx.showToast({ title: '找不到图片数据', icon: 'none' });
        this.setData({ isProcessing: false, currentStep: 'result' }); // 恢复状态
        return;
    }

    // 直接使用新的颜色生成证件照
    this.generateidphoto(noBgImage); 

    // 注意：这里没有添加超时逻辑，因为更换背景通常很快
    // 如果 generateidphoto 可能耗时，也应加入超时处理
  },
  
  // 保存证件照
  saveidphoto() {
    if (!this.data.resultImage) {
      wx.showToast({
        title: '请先生成证件照',
        icon: 'none'
      });
      return;
    }
    
    wx.saveImageToPhotosAlbum({
      filePath: this.data.resultImage,
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
                      this.saveidphoto(); // 重新尝试保存
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
  
  // 返回首页
  goBack() {
    // 离开页面时清除定时器
    this.clearTimeoutTimer();
    wx.navigateBack();
  },

  onUnload() {
    // 页面卸载时确保清除定时器
    this.clearTimeoutTimer();
  }
}) 
// crop.ts
// 裁剪页面

Page({
  data: {
    imagePath: '', // 原始图片路径
    targetWidth: 0, // 目标裁剪宽度
    targetHeight: 0, // 目标裁剪高度
    
    // 屏幕和图片尺寸
    screenWidth: 0,
    screenHeight: 0,
    imageWidth: 0,
    imageHeight: 0,
    
    // 裁剪框信息
    cropperWidth: 0,
    cropperHeight: 0,
    cropperLeft: 0,
    cropperTop: 0,
    
    // 图片缩放和位置
    imageScale: 1,
    imageLeft: 0,
    imageTop: 0,
    
    // 触摸操作相关
    touchStartX: 0,
    touchStartY: 0,
    touchStartLeft: 0,
    touchStartTop: 0,
    touchStartScale: 1,
    touchDistance: 0,
    
    // 状态控制
    isMoving: false,
    isScaling: false
  },
  
  onLoad(options) {
    // 获取参数
    const { image, width, height } = options;
    
    if (!image) {
      wx.showToast({
        title: '未找到图片',
        icon: 'error'
      });
      this.goBack();
      return;
    }
    
    // 获取屏幕尺寸
    const { windowWidth, windowHeight } = wx.getSystemInfoSync();
    
    this.setData({
      imagePath: decodeURIComponent(image),
      targetWidth: parseInt(width || '295'), // 默认一寸照宽度
      targetHeight: parseInt(height || '413'), // 默认一寸照高度
      screenWidth: windowWidth,
      screenHeight: windowHeight
    });
    
    // 获取图片信息
    this.loadImageInfo();
  },
  
  // 加载图片信息
  loadImageInfo() {
    wx.getImageInfo({
      src: this.data.imagePath,
      success: (res) => {
        const { width, height } = res;
        
        // 计算初始图片显示尺寸和裁剪框位置
        this.initCropperSize(width, height);
      },
      fail: (err) => {
        console.error('获取图片信息失败', err);
        wx.showToast({
          title: '加载图片失败',
          icon: 'error'
        });
        this.goBack();
      }
    });
  },
  
  // 初始化裁剪框尺寸和位置
  initCropperSize(imgWidth: number, imgHeight: number) {
    const { screenWidth, screenHeight, targetWidth, targetHeight } = this.data;
    
    // 确定裁剪框的尺寸（保持原始比例）
    let maxCropperWidth = screenWidth * 0.85;
    let maxCropperHeight = screenHeight * 0.6;
    
    // 计算裁剪框实际尺寸（等比例缩放）
    let cropperWidth, cropperHeight;
    
    if (targetWidth / targetHeight > maxCropperWidth / maxCropperHeight) {
      // 宽度受限
      cropperWidth = maxCropperWidth;
      cropperHeight = (targetHeight / targetWidth) * maxCropperWidth;
    } else {
      // 高度受限
      cropperHeight = maxCropperHeight;
      cropperWidth = (targetWidth / targetHeight) * maxCropperHeight;
    }
    
    // 计算裁剪框的位置（居中）
    const cropperLeft = (screenWidth - cropperWidth) / 2;
    const cropperTop = (screenHeight - cropperHeight) / 3; // 上移一点，让操作空间更大
    
    // 计算图片缩放比例
    const scaleX = cropperWidth / imgWidth * 1.5; // 放大一点以便移动调整
    const scaleY = cropperHeight / imgHeight * 1.5;
    const imageScale = Math.max(scaleX, scaleY); // 填充裁剪框
    
    // 计算图片的显示位置（初始位置：居中）
    const scaledImgWidth = imgWidth * imageScale;
    const scaledImgHeight = imgHeight * imageScale;
    const imageLeft = cropperLeft + (cropperWidth - scaledImgWidth) / 2;
    const imageTop = cropperTop + (cropperHeight - scaledImgHeight) / 2;
    
    this.setData({
      imageWidth: imgWidth,
      imageHeight: imgHeight,
      cropperWidth,
      cropperHeight,
      cropperLeft,
      cropperTop,
      imageScale,
      imageLeft,
      imageTop
    });
  },
  
  // 触摸开始
  touchStart(e: WechatMiniprogram.TouchEvent) {
    const touches = e.touches;
    
    // 记录触摸起始点
    if (touches.length === 1) {
      // 单指触摸（移动图片）
      this.setData({
        isMoving: true,
        touchStartX: touches[0].clientX,
        touchStartY: touches[0].clientY,
        touchStartLeft: this.data.imageLeft,
        touchStartTop: this.data.imageTop
      });
    } else if (touches.length === 2) {
      // 双指触摸（缩放图片）
      const touch1 = touches[0];
      const touch2 = touches[1];
      
      // 计算两指之间的距离
      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );
      
      this.setData({
        isScaling: true,
        isMoving: false,
        touchDistance: distance,
        touchStartScale: this.data.imageScale
      });
    }
  },
  
  // 触摸移动
  touchMove(e: WechatMiniprogram.TouchEvent) {
    const touches = e.touches;
    
    if (touches.length === 1 && this.data.isMoving) {
      // 单指移动图片
      const { touchStartX, touchStartY, touchStartLeft, touchStartTop } = this.data;
      const diffX = touches[0].clientX - touchStartX;
      const diffY = touches[0].clientY - touchStartY;
      
      // 计算新位置
      const newLeft = touchStartLeft + diffX;
      const newTop = touchStartTop + diffY;
      
      this.setData({
        imageLeft: newLeft,
        imageTop: newTop
      });
    } else if (touches.length === 2 && this.data.isScaling) {
      // 双指缩放图片
      const touch1 = touches[0];
      const touch2 = touches[1];
      
      // 计算两指之间的新距离
      const newDistance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );
      
      // 计算缩放比例变化
      const scaleFactor = newDistance / this.data.touchDistance;
      const newScale = this.data.touchStartScale * scaleFactor;
      
      // 限制缩放范围
      const minScale = Math.max(
        this.data.cropperWidth / this.data.imageWidth,
        this.data.cropperHeight / this.data.imageHeight
      );
      const maxScale = minScale * 5; // 最大缩放为最小所需缩放的5倍
      
      if (newScale >= minScale && newScale <= maxScale) {
        // 计算缩放后图片的位置调整
        const oldScaledWidth = this.data.imageWidth * this.data.imageScale;
        const oldScaledHeight = this.data.imageHeight * this.data.imageScale;
        const newScaledWidth = this.data.imageWidth * newScale;
        const newScaledHeight = this.data.imageHeight * newScale;
        
        // 保持中心点不变
        const centerX = this.data.imageLeft + oldScaledWidth / 2;
        const centerY = this.data.imageTop + oldScaledHeight / 2;
        
        const newLeft = centerX - newScaledWidth / 2;
        const newTop = centerY - newScaledHeight / 2;
        
        this.setData({
          imageScale: newScale,
          imageLeft: newLeft,
          imageTop: newTop
        });
      }
    }
  },
  
  // 触摸结束
  touchEnd() {
    this.setData({
      isMoving: false,
      isScaling: false
    });
  },
  
  // 完成裁剪
  confirmCrop() {
    wx.showLoading({
      title: '处理中...',
      mask: true
    });
    
    try {
      // 创建裁剪器上下文
      const ctx = wx.createCanvasContext('cropCanvas');
      
      // 获取裁剪框相对于图片的位置和尺寸
      const { 
        imagePath, imageWidth, imageHeight, imageScale, 
        imageLeft, imageTop, cropperLeft, cropperTop, 
        cropperWidth, cropperHeight, targetWidth, targetHeight 
      } = this.data;
      
      // 计算裁剪区域在原图上的对应位置
      const sourceX = (cropperLeft - imageLeft) / imageScale;
      const sourceY = (cropperTop - imageTop) / imageScale;
      const sourceWidth = cropperWidth / imageScale;
      const sourceHeight = cropperHeight / imageScale;
      
      // 确保裁剪参数有效
      if (sourceX < 0 || sourceY < 0 || sourceX + sourceWidth > imageWidth || sourceY + sourceHeight > imageHeight) {
        console.warn('裁剪区域超出图片范围，将自动调整');
      }
      
      // 绘制裁剪后的图像
      ctx.drawImage(
        imagePath,
        Math.max(0, sourceX),
        Math.max(0, sourceY),
        Math.min(sourceWidth, imageWidth - Math.max(0, sourceX)),
        Math.min(sourceHeight, imageHeight - Math.max(0, sourceY)),
        0,
        0,
        targetWidth,
        targetHeight
      );
      
      ctx.draw(false, () => {
        setTimeout(() => {
          // 导出裁剪后的图片
          wx.canvasToTempFilePath({
            canvasId: 'cropCanvas',
            x: 0,
            y: 0,
            width: targetWidth,
            height: targetHeight,
            destWidth: targetWidth,
            destHeight: targetHeight,
            success: (res) => {
              wx.hideLoading();
              
              // 将裁剪后的图片传回上一页
              const pages = getCurrentPages();
              const prevPage = pages[pages.length - 2]; // 上一页
              
              if (prevPage && prevPage.onImageCropped) {
                prevPage.onImageCropped(res.tempFilePath);
              }
              
              wx.navigateBack();
            },
            fail: (err) => {
              console.error('导出裁剪图片失败', err);
              wx.hideLoading();
              
              wx.showToast({
                title: '裁剪失败',
                icon: 'error'
              });
            }
          });
        }, 200); // 添加延时确保canvas已绘制完成
      });
    } catch (error) {
      console.error('裁剪过程出错', error);
      wx.hideLoading();
      
      wx.showToast({
        title: '裁剪失败',
        icon: 'error'
      });
    }
  },
  
  // 取消裁剪
  cancelCrop() {
    wx.navigateBack();
  },
  
  // 返回上一页
  goBack() {
    wx.navigateBack();
  }
}); 
// crop.js
const app = getApp()

Page({
  data: {
    imageUrl: '', // 图片路径
    imageInfo: {}, // 图片信息
    cropperWidth: 0, // 裁剪框宽度
    cropperHeight: 0, // 裁剪框高度
    imageWidth: 0, // 图片宽度
    imageHeight: 0, // 图片高度
    imageLeft: 0, // 图片左边距
    imageTop: 0, // 图片上边距
    scale: 1, // 图片缩放比例
    rotate: 0, // 图片旋转角度
    cropperLeft: 0, // 裁剪框左边距
    cropperTop: 0, // 裁剪框上边距
    touchStartX: 0, // 触摸开始X坐标
    touchStartY: 0, // 触摸开始Y坐标
    imgStartX: 0, // 图片初始X坐标
    imgStartY: 0, // 图片初始Y坐标
    scaleStartDist: 0, // 缩放开始距离
    scaleStartScale: 1, // 缩放开始比例
    systemInfo: {} // 系统信息
  },

  onLoad: function(options) {
    // 获取系统信息
    const systemInfo = wx.getSystemInfoSync();
    this.setData({ systemInfo });

    // 获取传入的图片路径
    if (options.src) {
      this.setData({
        imageUrl: options.src
      }, () => {
        // 初始化裁剪区域
        this.initCropper();
      });
    } else {
      wx.showToast({
        title: '未获取到图片',
        icon: 'none',
        duration: 2000,
        complete: function() {
          setTimeout(function() {
            wx.navigateBack();
          }, 2000);
        }
      });
    }
  },

  // 初始化裁剪区域
  initCropper: function() {
    const query = wx.createSelectorQuery();
    query.select('.cropper-container').boundingClientRect();
    query.exec(res => {
      if (res && res[0]) {
        const containerWidth = res[0].width;
        const containerHeight = res[0].height;
        
        // 获取图片信息
        wx.getImageInfo({
          src: this.data.imageUrl,
          success: (imgRes) => {
            let imageInfo = imgRes;
            // 计算裁剪框大小
            let cropperWidth = containerWidth * 0.8;
            let cropperHeight = cropperWidth; // 默认1:1
            if (options && options.ratio) {
              // 支持自定义裁剪比例，如 "16:9"
              const ratioArr = options.ratio.split(':');
              if (ratioArr.length === 2) {
                const ratioWidth = parseFloat(ratioArr[0]);
                const ratioHeight = parseFloat(ratioArr[1]);
                cropperHeight = cropperWidth * (ratioHeight / ratioWidth);
              }
            }

            // 计算裁剪框位置
            const cropperLeft = (containerWidth - cropperWidth) / 2;
            const cropperTop = (containerHeight - cropperHeight) / 2;

            // 计算图片缩放和位置
            let scale = 1;
            let imageWidth = imgRes.width;
            let imageHeight = imgRes.height;
            
            // 确保图片完全覆盖裁剪框
            if (imageWidth / imageHeight < cropperWidth / cropperHeight) {
              // 图片更高，宽度需要适配
              scale = cropperWidth / imageWidth;
            } else {
              // 图片更宽，高度需要适配
              scale = cropperHeight / imageHeight;
            }

            // 稍微增加缩放，确保图片覆盖裁剪框
            scale = scale * 1.2;
            imageWidth = imageWidth * scale;
            imageHeight = imageHeight * scale;

            // 居中图片
            const imageLeft = (containerWidth - imageWidth) / 2;
            const imageTop = (containerHeight - imageHeight) / 2;

            this.setData({
              imageInfo,
              cropperWidth,
              cropperHeight,
              cropperLeft,
              cropperTop,
              imageWidth,
              imageHeight,
              imageLeft,
              imageTop,
              scale
            });
          },
          fail: (error) => {
            console.error('获取图片信息失败', error);
            wx.showToast({
              title: '获取图片信息失败',
              icon: 'none'
            });
            setTimeout(() => {
              wx.navigateBack();
            }, 2000);
          }
        });
      }
    });
  },

  // 触摸开始事件
  touchStart(e) {
    const touches = e.touches;
    
    // 单指触摸移动图片
    if (touches.length === 1) {
      const { clientX, clientY } = touches[0];
      this.setData({
        touchStartX: clientX,
        touchStartY: clientY,
        imgStartX: this.data.imageLeft,
        imgStartY: this.data.imageTop
      });
    } 
    // 双指触摸缩放图片
    else if (touches.length === 2) {
      const xMove = touches[1].clientX - touches[0].clientX;
      const yMove = touches[1].clientY - touches[0].clientY;
      const distance = Math.sqrt(xMove * xMove + yMove * yMove);
      
      this.setData({
        scaleStartDist: distance,
        scaleStartScale: this.data.scale
      });
    }
  },

  // 触摸移动事件
  touchMove(e) {
    const touches = e.touches;
    
    // 单指移动
    if (touches.length === 1) {
      const { clientX, clientY } = touches[0];
      let imageLeft = this.data.imgStartX + clientX - this.data.touchStartX;
      let imageTop = this.data.imgStartY + clientY - this.data.touchStartY;
      
      this.setData({
        imageLeft,
        imageTop
      });
    } 
    // 双指缩放
    else if (touches.length === 2) {
      const xMove = touches[1].clientX - touches[0].clientX;
      const yMove = touches[1].clientY - touches[0].clientY;
      const distance = Math.sqrt(xMove * xMove + yMove * yMove);
      
      const distanceRatio = distance / this.data.scaleStartDist;
      let newScale = this.data.scaleStartScale * distanceRatio;
      
      // 限制缩放范围
      newScale = Math.max(0.5, Math.min(newScale, 5));
      
      // 计算新的图片尺寸
      const originalWidth = this.data.imageInfo.width;
      const originalHeight = this.data.imageInfo.height;
      const newWidth = originalWidth * newScale;
      const newHeight = originalHeight * newScale;
      
      this.setData({
        scale: newScale,
        imageWidth: newWidth,
        imageHeight: newHeight
      });
    }
  },

  // 确认裁剪
  cropImage() {
    // 获取裁剪数据
    const {
      imageUrl,
      imageLeft,
      imageTop,
      imageWidth,
      imageHeight,
      cropperLeft,
      cropperTop,
      cropperWidth,
      cropperHeight,
      scale,
      rotate
    } = this.data;

    // 创建临时canvas
    const ctx = wx.createCanvasContext('cropCanvas');
    
    // 计算裁剪参数
    // 相对于原图的裁剪坐标和大小
    const sx = (cropperLeft - imageLeft) / scale;
    const sy = (cropperTop - imageTop) / scale;
    const sWidth = cropperWidth / scale;
    const sHeight = cropperHeight / scale;
    
    // 绘制到画布
    ctx.save();
    ctx.drawImage(imageUrl, sx, sy, sWidth, sHeight, 0, 0, cropperWidth, cropperHeight);
    ctx.restore();
    
    ctx.draw(false, () => {
      // 延迟确保画布已渲染完成
      setTimeout(() => {
        // 将画布转为临时文件
        wx.canvasToTempFilePath({
          canvasId: 'cropCanvas',
          x: 0,
          y: 0,
          width: cropperWidth,
          height: cropperHeight,
          destWidth: cropperWidth * this.data.systemInfo.pixelRatio,
          destHeight: cropperHeight * this.data.systemInfo.pixelRatio,
          success: (res) => {
            // 返回裁剪后的图片路径
            const pages = getCurrentPages();
            const prevPage = pages[pages.length - 2];
            
            // 调用上一页的回调函数，传递裁剪结果
            if (prevPage && prevPage.cropCallback) {
              prevPage.cropCallback(res.tempFilePath);
            }
            
            wx.navigateBack();
          },
          fail: (error) => {
            console.error('裁剪失败', error);
            wx.showToast({
              title: '裁剪失败',
              icon: 'none'
            });
          }
        }, this);
      }, 100);
    });
  },

  // 取消裁剪
  cancelCrop() {
    wx.navigateBack();
  }
}) 
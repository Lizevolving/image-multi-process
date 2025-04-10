const app = getApp();

Page({
  /**
   * 页面的初始数据
   */
  data: {
    // 页面状态
    isUploading: false,
    isRecognizing: false,
    showResults: false,
    showPromptInput: false,
    pageState: 'upload', // 兼容原有状态: 'upload', 'preview', 'loading', 'result'
    
    // 图片相关
    tempImagePath: '',
    imagePath: '', // 兼容原有变量名
    imageUrl: '',
    
    // 自定义提示
    customPrompt: '',
    
    // 错误信息
    errorMessage: '',
    errorMsg: '', // 兼容原有变量名
    
    // 是否显示自定义提示输入框
    showCustomPrompt: false, // 兼容原有变量名
    
    // 识别结果
    recognitionResults: {
      mainContent: '',
      objects: [],
      scene: '',
      textContent: '',
      fullDescription: ''
    },
    recognitionResult: null, // 兼容原有变量名
    
    // 默认图片
    defaultImage: '/assets/images/default-image.png'
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    // 如果从其他页面传入图片路径，直接显示
    if (options.imagePath) {
      this.setData({
        tempImagePath: options.imagePath,
        imagePath: options.imagePath,
        pageState: 'preview',
        showResults: false
      });
      
      // 自动开始识别
      this.startRecognition();
    }
    
    // 页面加载时的初始化逻辑
    if (options.mode && options.mode === 'camera') {
      this.takePhoto();
    }
  },

  /**
   * 选择图片
   */
  chooseImage: function() {
    const that = this;
    
    // 重置状态
    this.setData({
      isUploading: true,
      showResults: false,
      errorMessage: '',
      errorMsg: '',
      recognitionResults: {
        mainContent: '',
        objects: [],
        scene: '',
        textContent: '',
        fullDescription: ''
      },
      recognitionResult: null
    });
    
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      camera: 'back',
      success: function(res) {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        that.setData({
          tempImagePath: tempFilePath,
          imagePath: tempFilePath,
          pageState: 'preview',
          isUploading: false
        });
      },
      fail: function(err) {
        console.error('选择图片失败', err);
        that.setData({
          isUploading: false,
          errorMessage: '选择图片失败，请重试',
          errorMsg: '选择图片失败'
        });
        wx.showToast({
          title: '选择图片失败',
          icon: 'none'
        });
      }
    });
  },

  /**
   * 直接拍照
   */
  takePhoto: function() {
    const that = this;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera'],
      success: function(res) {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        that.setData({
          tempImagePath: tempFilePath,
          imagePath: tempFilePath,
          pageState: 'preview',
          recognitionResult: null,
          recognitionResults: {
            mainContent: '',
            objects: [],
            scene: '',
            textContent: '',
            fullDescription: ''
          },
          showCustomPrompt: false
        });
      },
      fail: function (err) {
        console.error('拍照失败', err);
        wx.showToast({
          title: '拍照失败',
          icon: 'none'
        });
      }
    });
  },
  
  /**
   * 切换自定义提示输入框的显示状态
   */
  togglePromptInput: function() {
    this.setData({
      showPromptInput: !this.data.showPromptInput,
      showCustomPrompt: !this.data.showCustomPrompt // 同时更新原有变量
    });
  },
  
  /**
   * 显示/隐藏自定义提示输入框 (原有方法)
   */
  toggleCustomPrompt: function() {
    this.setData({
      showCustomPrompt: !this.data.showCustomPrompt,
      showPromptInput: !this.data.showPromptInput // 同时更新新变量
    });
  },

  /**
   * 监听自定义提示输入变化
   */
  onPromptInput: function(e) {
    this.setData({
      customPrompt: e.detail.value
    });
  },
  
  /**
   * 更新自定义提示文本 (原有方法)
   */
  updateCustomPrompt: function(e) {
    this.setData({
      customPrompt: e.detail.value
    });
  },
  
  /**
   * 开始识别
   */
  startRecognition: function() {
    // 如果没有选择图片，提示用户
    if (!this.data.imagePath && !this.data.tempImagePath) {
      this.setData({
        errorMessage: '请先选择一张图片',
        errorMsg: '请先选择图片'
      });
      wx.showToast({
        title: '请先选择图片',
        icon: 'none'
      });
      return;
    }
    
    // 设置加载状态
    this.setData({
      isRecognizing: true,
      pageState: 'loading',
      errorMessage: '',
      errorMsg: ''
    });
    
    // 上传图片到服务器
    this.uploadImageAndRecognize();
  },
  
  /**
   * 上传图片并识别
   */
  uploadImageAndRecognize: function() {
    const that = this;
    const imagePath = this.data.tempImagePath || this.data.imagePath;
    
    // 上传图片到服务器并进行图像识别
    wx.uploadFile({
      url: app.globalData.baseUrl + '/api/image-recognition',
      filePath: imagePath,
      name: 'image',
      formData: {
        prompt: this.data.customPrompt || '识别图片内容'
      },
      success: function (res) {
        try {
          const result = JSON.parse(res.data);
          if (result.success) {
            // 解析返回的结果 - 同时更新新旧两种数据格式
            that.setData({
              pageState: 'result',
              isRecognizing: false,
              showResults: true,
              recognitionResult: {
                main_content: result.data.main_content || '未检测到主要内容',
                objects: result.data.objects || [],
                scene: result.data.scene || '未识别场景',
                text: result.data.text || '未检测到文字',
                full_description: result.data.full_description || '无法生成完整描述'
              },
              recognitionResults: {
                mainContent: result.data.main_content || '未检测到主要内容',
                objects: result.data.objects || [],
                scene: result.data.scene || '未识别场景',
                textContent: result.data.text || '未检测到文字',
                fullDescription: result.data.full_description || '无法生成完整描述'
              }
            });
          } else {
            that.setData({
              pageState: 'preview',
              isRecognizing: false,
              errorMsg: result.message || '图像识别失败',
              errorMessage: result.message || '图像识别失败'
            });
            wx.showToast({
              title: result.message || '图像识别失败',
              icon: 'none'
            });
          }
        } catch (error) {
          console.error('解析结果失败', error);
          that.setData({
            pageState: 'preview',
            isRecognizing: false,
            errorMsg: '解析结果失败',
            errorMessage: '解析结果失败'
          });
          wx.showToast({
            title: '解析结果失败',
            icon: 'none'
          });
        }
      },
      fail: function (err) {
        console.error('图像识别请求失败', err);
        that.setData({
          pageState: 'preview',
          isRecognizing: false,
          errorMsg: '网络请求失败，请检查网络连接',
          errorMessage: '上传图片失败，请检查网络连接后重试'
        });
        wx.showToast({
          title: '网络请求失败',
          icon: 'none'
        });
      }
    });
  },
  
  /**
   * 重新选择图片
   */
  reSelectImage: function() {
    this.setData({
      tempImagePath: '',
      pageState: 'upload',
      showResults: false,
      isRecognizing: false,
      customPrompt: '',
      errorMessage: '',
      errorMsg: ''
    });
    
    this.chooseImage();
  },
  
  /**
   * 分享结果
   */
  shareResults: function() {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });
  },
  
  /**
   * 分享识别结果 (原有方法)
   */
  shareResult: function() {
    if (this.data.pageState !== 'result' || (!this.data.recognitionResult && !this.data.recognitionResults.mainContent)) {
      wx.showToast({
        title: '暂无结果可分享',
        icon: 'none'
      });
      return;
    }

    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });
  },
  
  /**
   * 返回上一页
   */
  navigateBack: function() {
    wx.navigateBack({
      delta: 1
    });
  },
  
  /**
   * 返回首页 (原有方法)
   */
  goBack: function() {
    wx.navigateBack({
      delta: 1
    });
  },
  
  /**
   * 用户点击右上角分享
   */
  onShareAppMessage: function() {
    const mainContent = this.data.recognitionResults.mainContent || 
                       (this.data.recognitionResult ? this.data.recognitionResult.main_content : '');
    const imagePath = this.data.tempImagePath || this.data.imagePath;
    
    return {
      title: '我用AI识别出了这张图片：' + mainContent,
      path: '/pages/index/index',
      imageUrl: imagePath
    };
  },
  
  /**
   * 分享到朋友圈
   */
  onShareTimeline: function() {
    const mainContent = this.data.recognitionResults.mainContent || 
                       (this.data.recognitionResult ? this.data.recognitionResult.main_content : '');
    const imagePath = this.data.tempImagePath || this.data.imagePath;
    
    return {
      title: '我用AI识别出了这张图片：' + mainContent,
      imageUrl: imagePath
    };
  }
}); 
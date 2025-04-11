// recognize.ts
import { imageToBase64WithMime } from '../../utils/base64';
import { getAPIQuota } from '../../services/backgroundService';

interface ResultSection {
  title: string;
  content: string;
}

Page({
  data: {
    image: '', // 选择的图片路径
    imageBase64: '', // 图片的Base64编码
    customPrompt: '', // 用户自定义的额外要求
    recognizeResult: null, // 识别结果
    isLoading: false, // 是否正在加载中
    resultSections: [] as ResultSection[], // 识别结果分段
    API_KEY: '7e09446c-8e86-4a1a-970e-6006a46b70c1', // API密钥
    showCustomPromptInput: false, // 是否显示自定义提示输入框
    apiQuota: { used: 0, total: 30 }, // API使用情况
    uploadProgress: 0, // 上传进度
    processingProgress: 0, // 处理进度
  },

  // 定义进度条定时器
  progressTimer: null as any,
  
  // 定义超时定时器
  timeoutTimer: null as any,

  onLoad() {
    console.log('图片识别页面加载');
    // 获取API使用情况
    const apiQuota = getAPIQuota();
    this.setData({ apiQuota });
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
        
        // 重置之前的结果
        this.setData({
          image: tempFilePath,
          recognizeResult: null,
          resultSections: [],
          isLoading: false,
          uploadProgress: 0,
          processingProgress: 0
        });
        
        // 将图片转为Base64
        this.convertImageToBase64(tempFilePath);
      }
    });
  },
  
  // 将图片转为Base64编码
  convertImageToBase64(imagePath: string) {
    wx.showLoading({ title: '处理图片中...', mask: true });
    
    // 使用工具函数转换图片为Base64
    imageToBase64WithMime(imagePath)
      .then((base64Data: string) => {
        this.setData({
          imageBase64: base64Data,
          uploadProgress: 100 // 图片转换完成
        });
        wx.hideLoading();
      })
      .catch((err: any) => {
        console.error('图片转Base64失败:', err);
        wx.hideLoading();
        wx.showToast({
          title: '图片处理失败',
          icon: 'error'
        });
      });
  },
  
  // 切换显示自定义提示输入框
  toggleCustomPrompt() {
    this.setData({
      showCustomPromptInput: !this.data.showCustomPromptInput
    });
  },
  
  // 更新自定义提示
  onCustomPromptInput(e: any) {
    this.setData({
      customPrompt: e.detail.value
    });
  },
  
  // 开始识别图片
  recognizeImage() {
    if (!this.data.imageBase64) {
      wx.showToast({
        title: '请先选择图片',
        icon: 'none'
      });
      return;
    }
    
    // 检查API额度
    const apiQuota = getAPIQuota();
    if (apiQuota.used >= apiQuota.total) {
      wx.showModal({
        title: '提示',
        content: '今日图像识别次数已用完，请明天再试',
        showCancel: false
      });
      return;
    }
    
    this.setData({
      isLoading: true,
      processingProgress: 0
    });
    
    wx.showLoading({
      title: '识别中...',
      mask: true
    });
    
    // 启动进度模拟
    this.simulateProgress();
    
    // 设置超时处理 - 15秒后强制停止
    this.timeoutTimer = setTimeout(() => {
      if (this.data.isLoading) {
        // 清除进度条
        if (this.progressTimer) {
          clearInterval(this.progressTimer);
          this.progressTimer = null;
        }
        
        // 关闭加载提示
        wx.hideLoading();
        
        // 重置状态
        this.setData({
          isLoading: false,
          processingProgress: 0
        });
        
        // 提示用户
        wx.showModal({
          title: '处理超时',
          content: '图片识别处理时间过长，请稍后重试',
          showCancel: false
        });
      }
    }, 15000); // 15秒超时
    
    // 10秒后给出"耐心等待"提示
    setTimeout(() => {
      if (this.data.isLoading && this.data.processingProgress < 90) {
        wx.showToast({
          title: '处理中，请耐心等待',
          icon: 'none',
          duration: 2000
        });
      }
    }, 10000);
    
    // 准备请求数据 - 使用正确的请求格式
    const requestData = {
      model: "doubao-vision-lite-32k-241015",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `请综合分析图片内容（包括主体、场景、色彩、文字、风格等），生成一段自然流畅、富有吸引力的中文描述文字。字数限制在50-500字之间。请根据图片类型（人物、商品、风景等）自适应调整描述重点和风格。额外需求：${this.data.customPrompt || '无'}`
            },
            {
              type: "image_url",
              image_url: {
                url: this.data.imageBase64
              }
            }
          ]
        }
      ]
    };
    
    // 调用API
    wx.request({
      url: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
      method: 'POST',
      header: {
        'Authorization': `Bearer ${this.data.API_KEY}`,
        'Content-Type': 'application/json'
      },
      data: requestData,
      success: (res: any) => {
        console.log('识别结果:', res.data);
        
        // 清除超时定时器
        if (this.timeoutTimer) {
          clearTimeout(this.timeoutTimer);
          this.timeoutTimer = null;
        }
        
        // 更新API使用情况
        const updatedQuota = getAPIQuota();
        updatedQuota.used += 1;
        wx.setStorageSync('api_quota', updatedQuota);
        
        this.setData({
          apiQuota: updatedQuota,
          processingProgress: 100
        });
        
        if (res.data && res.data.choices && res.data.choices.length > 0) {
          const content = res.data.choices[0].message.content;        // 是根据响应结构来抽取content的
          
          // 处理响应结果，将其分为不同的部分
          const sections = this.parseResult(content);
          
          this.setData({
            recognizeResult: content,
            resultSections: sections
          });
        } else {
          wx.showToast({
            title: '未获取到有效结果',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        console.error('API请求失败:', err);
        
        // 清除超时定时器
        if (this.timeoutTimer) {
          clearTimeout(this.timeoutTimer);
          this.timeoutTimer = null;
        }
        
        wx.showToast({
          title: '识别失败，请稍后重试',
          icon: 'error'
        });
      },
      complete: () => {
        // 清除进度条
        if (this.progressTimer) {
          clearInterval(this.progressTimer);
          this.progressTimer = null;
        }
        
        this.setData({
          isLoading: false,
          processingProgress: 100
        });
        
        wx.hideLoading();
      }
    });
  },
  
  // 模拟进度条
  simulateProgress() {
    let progress = 0;
    const timer = setInterval(() => {
      // 进度最多到95%，等待实际完成
      if (progress < 95) {
        progress += Math.random() * 5;
        if (progress > 95) progress = 95;
        
        this.setData({
          processingProgress: progress
        });
      } else if (!this.data.isLoading) {
        // 如果已经不是加载状态，清除定时器
        clearInterval(timer);
      }
    }, 200);
    
    // 保存定时器ID，以便在需要时清除
    this.progressTimer = timer;
  },
  
  // 解析API响应结果
  parseResult(content: string): Array<{title: string, content: string}> {
    // 如果内容为空，返回空数组
    if (!content) return [];
    
    // 不再分割，直接返回包含完整内容的单一结果
    return [{ title: '分析结果', content: content }];
  },
  
  // 返回首页
  goBack() {
    // 清除定时器
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
    
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
    
    wx.navigateBack();
  },
  
  // 重新选择图片
  resetImage() {
    // 清除定时器
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
    
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
    
    this.setData({
      image: '',
      imageBase64: '',
      recognizeResult: null,
      resultSections: [],
      isLoading: false,
      customPrompt: '',
      showCustomPromptInput: false,
      uploadProgress: 0,
      processingProgress: 0
    });
  },
  
  onUnload() {
    // 页面卸载时清除定时器
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
    
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
  },
  
  /**
   * 用户点击右上角分享
   */
  onShareAppMessage: function() {
    const section = this.data.resultSections.length > 0 
      ? this.data.resultSections[0] 
      : { content: '精彩图片内容' };
    
    return {
      title: '我用AI识别出了这张图片：' + section.content.substring(0, 20) + '...',
      path: '/pages/index/index',
      imageUrl: this.data.image
    };
  }
}); 
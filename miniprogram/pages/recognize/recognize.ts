// recognize.ts
import { base64EncodeURL } from '../../utils/base64';

Page({
  data: {
    image: '', // 选择的图片路径
    imageBase64: '', // 图片的Base64编码
    customPrompt: '', // 用户自定义的额外要求
    recognizeResult: null, // 识别结果
    isLoading: false, // 是否正在加载中
    resultSections: [], // 识别结果分段
    API_KEY: '7e09446c-8e86-4a1a-970e-6006a46b70c1', // API密钥
    showCustomPromptInput: false, // 是否显示自定义提示输入框
  },

  onLoad() {
    console.log('图片识别页面加载');
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
          isLoading: false
        });
        
        // 将图片转为Base64
        this.convertImageToBase64(tempFilePath);
      }
    });
  },
  
  // 将图片转为Base64编码
  convertImageToBase64(imagePath: string) {
    wx.showLoading({ title: '处理图片中...', mask: true });
    
    // 获取图片信息
    wx.getFileSystemManager().readFile({
      filePath: imagePath,
      encoding: 'base64',
      success: (res) => {
        // 获取图片类型
        wx.getImageInfo({
          src: imagePath,
          success: (imageInfo) => {
            // 根据实际图片类型设置MIME类型
            const imageType = imageInfo.type || 'jpeg';
            const base64Data = `data:image/${imageType};base64,${res.data}`;
            
            this.setData({
              imageBase64: base64Data
            });
            
            wx.hideLoading();
          },
          fail: (err) => {
            console.error('获取图片信息失败:', err);
            // 默认使用jpeg格式
            const base64Data = `data:image/jpeg;base64,${res.data}`;
            
            this.setData({
              imageBase64: base64Data
            });
            
            wx.hideLoading();
          }
        });
      },
      fail: (err) => {
        console.error('读取图片失败:', err);
        wx.hideLoading();
        wx.showToast({
          title: '图片处理失败',
          icon: 'error'
        });
      }
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
    
    this.setData({
      isLoading: true
    });
    
    wx.showLoading({
      title: '识别中...',
      mask: true
    });
    
    // 准备请求数据
    const requestData = {
      model: "ep-20250125153900-7jmrx",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `请分析图片内容并返回以下结构化结果：1.主体对象识别 2.场景描述 3.色彩分析 4.文字提取(如有) 5.风格判断（如需）。要求：用中文输出，确保有新意、保证用户体验，同时对人物/商品/风景等不同类别自适应处理。用户额外需求：${this.data.customPrompt || '无'}`
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
      url: 'https://ark.cn-beijing.volces.com/api/V3/chat/completions',
      method: 'POST',
      header: {
        'Authorization': `Bearer ${this.data.API_KEY}`,
        'Content-Type': 'application/json'
      },
      data: requestData,
      success: (res: any) => {
        console.log('识别结果:', res.data);
        
        if (res.data && res.data.choices && res.data.choices.length > 0) {
          const content = res.data.choices[0].message.content;
          
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
        wx.showToast({
          title: '识别失败',
          icon: 'error'
        });
      },
      complete: () => {
        this.setData({
          isLoading: false
        });
        wx.hideLoading();
      }
    });
  },
  
  // 解析API响应结果
  parseResult(content: string): Array<{title: string, content: string}> {
    // 如果内容为空，返回空数组
    if (!content) return [];
    
    const sections = [];
    
    // 尝试匹配常见的章节标题
    const sectionTitles = [
      '主体对象识别', '对象识别', '物体识别',
      '场景描述', '场景分析', 
      '色彩分析', '颜色分析',
      '文字提取', '文本提取', '文字识别',
      '风格判断', '风格分析'
    ];
    
    // 分割内容查找各部分
    let currentTitle = '分析结果';
    let currentContent = '';
    
    // 按行分割内容
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // 跳过空行
      if (!line) continue;
      
      // 检查是否为章节标题
      let isTitle = false;
      for (const title of sectionTitles) {
        // 匹配形如"1. 主体对象识别"或"主体对象识别："的标题
        const regex = new RegExp(`(?:\\d+\\.?\\s*)?${title}[：:]*`, 'i');
        if (regex.test(line)) {
          // 如果已有内容，保存之前的部分
          if (currentContent) {
            sections.push({
              title: currentTitle,
              content: currentContent.trim()
            });
          }
          
          // 开始新的部分
          currentTitle = title;
          currentContent = line.replace(regex, '').trim();
          isTitle = true;
          break;
        }
      }
      
      // 如果不是标题，则添加到当前内容
      if (!isTitle) {
        currentContent += '\n' + line;
      }
    }
    
    // 添加最后一部分
    if (currentContent) {
      sections.push({
        title: currentTitle,
        content: currentContent.trim()
      });
    }
    
    // 如果没有找到任何部分，则将整个内容作为一个部分
    if (sections.length === 0 && content) {
      sections.push({
        title: '分析结果',
        content: content
      });
    }
    
    return sections;
  },
  
  // 返回首页
  goBack() {
    wx.navigateBack();
  },
  
  // 重新选择图片
  resetImage() {
    this.setData({
      image: '',
      imageBase64: '',
      recognizeResult: null,
      resultSections: [],
      isLoading: false,
      customPrompt: '',
      showCustomPromptInput: false
    });
  }
}); 
/**
 * 背景去除服务
 * 封装了remove.bg API的调用
 */

// API配置
const API_URL = 'https://api.remove.bg/v1.0/removebg';
const DEFAULT_API_KEY = 'TrSfg7escwbcAKvHZ36M6mes';

// API限额监控
const API_QUOTA = {
  total: 30,  // 每日总额度为30次
  used: 0,    // 已使用次数
  resetDate: new Date().toISOString().split('T')[0]  // 重置日期
};

/**
 * 获取API使用情况
 * @returns {Object} API使用统计
 */
export function getAPIQuota() {
  // 实际应用中，应该从服务器或本地存储获取最新使用量
  const quota = wx.getStorageSync('api_quota') || API_QUOTA;
  
  // 如果日期变了，重置计数
  const today = new Date().toISOString().split('T')[0];
  if (quota.resetDate !== today) {
    quota.used = 0;
    quota.resetDate = today;
    wx.setStorageSync('api_quota', quota);
  }
  
  return quota;
}

/**
 * 更新API使用量并显示友好提示
 */
function updateAPIUsage() {
  const quota = getAPIQuota();
  quota.used += 1;
  wx.setStorageSync('api_quota', quota);
  
  // 在达到特定次数时显示友好提示
  if (quota.used === 10) {
    wx.showToast({
      title: '今日已完成10次图像处理',
      icon: 'none',
      duration: 2000
    });
  } else if (quota.used === 20) {
    wx.showToast({
      title: '今日已完成20次图像处理',
      icon: 'none',
      duration: 2000
    });
  } else if (quota.used === 30) {
    wx.showModal({
      title: '提示',
      content: '今日图像处理次数已用完，请明天再试',
      showCancel: false
    });
  }
  
  return quota;
}

/**
 * 检查API限额
 * @returns {boolean} 是否超出限额
 */
export function checkAPIQuota() {
  const quota = getAPIQuota();
  return quota.used < quota.total;
}

/**
 * 去除图片背景 - 纯前端直连方式
 * 注意：需要在小程序管理后台添加api.remove.bg为合法域名
 * 
 * @param {string} imagePath 图片路径
 * @param {string} apiKey API密钥
 * @param {string} size 输出图片尺寸
 * @returns {Promise<string>} 处理后的图片临时路径
 */
export function removeBackground(imagePath: string, apiKey: string = DEFAULT_API_KEY, size: string = 'auto'): Promise<string> {
  return new Promise((resolve, reject) => {
    // 检查API限额
    if (!checkAPIQuota()) {
      reject(new Error('API调用次数已达到今日限额，请明天再试'));
      return;
    }

    // 显示加载提示
    wx.showLoading({
      title: '处理中...',
      mask: true
    });

    // 压缩图片再上传，提高性能
    compressImage(imagePath).then(compressedPath => {
      wx.uploadFile({
        url: API_URL,
        filePath: compressedPath,
        name: 'image_file',
        header: {
          'X-Api-Key': apiKey
        },
        formData: {
          size: size,
          format: 'png'
        },
        timeout: 30000,  // 30秒超时
        success: (res) => {
          if (res.statusCode === 200) {
            // 更新API使用量
            updateAPIUsage();
            
            try {
              // 获取文件系统管理器，用于文件操作
              const fs = wx.getFileSystemManager();
              
              // 为图片创建一个唯一的临时路径
              const timestamp = Date.now();
              const tempFilePath = `${wx.env.USER_DATA_PATH}/temp_${timestamp}.png`;
              
              // 直接将返回的二进制数据写入文件
              // 不尝试解析JSON，因为remove.bg API通常直接返回图片数据
              fs.writeFile({
                filePath: tempFilePath,
                data: res.data,
                encoding: 'binary', // 尝试使用binary编码，而不是base64
                success: () => {
                  // 使用文件系统的saveFile而不是wx.saveFile
                  const savedFilePath = `${wx.env.USER_DATA_PATH}/bg_removed_${timestamp}.png`;
                  
                  fs.saveFile({
                    tempFilePath: tempFilePath,
                    filePath: savedFilePath,
                    success: () => {
                      // 隐藏加载提示
                      wx.hideLoading();
                      resolve(savedFilePath);
                      
                      // 清理临时文件
                      fs.unlink({
                        filePath: tempFilePath,
                        fail: (err) => {
                          console.warn('清理临时文件失败', err);
                        }
                      });
                    },
                    fail: (err) => {
                      console.error('保存文件失败', err);
                      wx.hideLoading();
                      
                      // 尝试直接返回临时文件路径
                      resolve(tempFilePath);
                    }
                  });
                },
                fail: (err) => {
                  console.error('写入文件失败', err);
                  wx.hideLoading();
                  reject(new Error('处理图片数据失败: ' + err.errMsg));
                }
              });
            } catch (err) {
              console.error('处理返回数据失败', err);
              wx.hideLoading();
              reject(new Error('处理图片数据失败'));
            }
          } else {
            // 处理API错误
            let errorMsg = '抠图处理失败';
            wx.hideLoading();
            
            try {
              const error = JSON.parse(res.data);
              errorMsg = error.errors && error.errors[0] ? error.errors[0].title : '抠图处理失败';
              
              // 检查是否是API额度限制错误
              if (res.statusCode === 429 || (error.errors && error.errors[0] && error.errors[0].code === 'rate_limit_exceeded')) {
                // 强制更新用量为限额
                const quota = getAPIQuota();
                quota.used = quota.total;
                wx.setStorageSync('api_quota', quota);
                errorMsg = 'API调用次数已达到限额，请稍后再试';
              }
            } catch (e) {
              console.error('解析错误信息失败', e);
            }
            
            reject(new Error(errorMsg));
          }
        },
        fail: (err) => {
          console.error('API请求失败', err);
          wx.hideLoading();
          let errorMsg = '网络请求失败';
          
          if (err.errMsg.includes('timeout')) {
            errorMsg = '请求超时，请检查网络连接';
          }
          
          reject(new Error(errorMsg));
        }
      });
    }).catch(err => {
      wx.hideLoading();
      reject(err);
    });
  });
}

/**
 * 压缩图片
 * @param {string} imagePath 原图路径
 * @returns {Promise<string>} 压缩后的图片路径
 */
function compressImage(imagePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // 由于canvas出现错误，暂时跳过压缩直接使用原图
    resolve(imagePath);
    
    // 下面是原来的压缩代码，现在暂时不使用，避免canvas错误
    /*
    // 获取图片信息
    wx.getImageInfo({
      src: imagePath,
      success: (imageInfo) => {
        // 计算压缩比例，宽度最大为1000px
        const maxWidth = 1000;
        const originalWidth = imageInfo.width;
        const originalHeight = imageInfo.height;
        
        if (originalWidth <= maxWidth) {
          // 图片足够小，不需要压缩
          resolve(imagePath);
          return;
        }
        
        // 计算新尺寸
        const scale = maxWidth / originalWidth;
        const targetWidth = maxWidth;
        const targetHeight = Math.floor(originalHeight * scale);
        
        // 创建canvas压缩
        const ctx = wx.createCanvasContext('compressCanvas');
        
        ctx.drawImage(imagePath, 0, 0, targetWidth, targetHeight);
        ctx.draw(false, () => {
          wx.canvasToTempFilePath({
            canvasId: 'compressCanvas',
            x: 0,
            y: 0,
            width: targetWidth,
            height: targetHeight,
            quality: 0.8,
            success: (res) => {
              resolve(res.tempFilePath);
            },
            fail: (err) => {
              console.error('压缩图片失败', err);
              // 如果压缩失败，使用原图
              resolve(imagePath);
            }
          });
        });
      },
      fail: (err) => {
        console.error('获取图片信息失败', err);
        // 如果获取信息失败，使用原图
        resolve(imagePath);
      }
    });
    */
  });
}

/**
 * 通过微信云开发调用背景去除服务
 * 实际项目中的推荐实现方式
 * 
 * @param {string} imagePath 图片路径
 * @returns {Promise<string>} 处理后的图片临时路径
 */
export function removeBackgroundViaCloud(imagePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // 1. 上传图片到云存储
    wx.cloud.uploadFile({
      cloudPath: `temp/${Date.now()}.jpg`,
      filePath: imagePath,
      success: res => {
        const fileID = res.fileID;
        
        // 2. 调用云函数处理图片
        wx.cloud.callFunction({
          name: 'removeBackground',
          data: {
            fileID: fileID
          },
          success: result => {
            // 3. 获取处理后的图片临时链接
            // 安全检查处理result
            if (result && result.result && typeof result.result === 'object') {
              const processedFileID = result.result.fileID;
              
              if (processedFileID) {
                wx.cloud.getTempFileURL({
                  fileList: [processedFileID],
                  success: res => {
                    if (res.fileList && res.fileList.length > 0) {
                      resolve(res.fileList[0].tempFileURL);
                    } else {
                      reject(new Error('获取临时链接失败'));
                    }
                  },
                  fail: err => {
                    reject(err);
                  }
                });
              } else {
                reject(new Error('未获取到处理结果'));
              }
            } else {
              reject(new Error('云函数返回结果格式错误'));
            }
          },
          fail: err => {
            reject(err);
          }
        });
      },
      fail: err => {
        reject(err);
      }
    });
  });
} 
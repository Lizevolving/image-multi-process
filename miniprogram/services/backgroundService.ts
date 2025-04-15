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

// 超时设置
const TIMEOUT_SETTINGS = {
  PATIENT_HINT: 10000, // 10秒后给出耐心提示
  FORCE_QUIT: 15000,   // 15秒后强制退出
};

// 超时定时器
let patientHintTimer: number | null = null;
let forceQuitTimer: number | null = null;

/**
 * 清除所有超时定时器
 */
function clearAllTimers() {
  if (patientHintTimer) {
    clearTimeout(patientHintTimer);
    patientHintTimer = null;
  }
  
  if (forceQuitTimer) {
    clearTimeout(forceQuitTimer);
    forceQuitTimer = null;
  }
}

/**
 * 启动标准超时处理机制
 * @param {Function} onForceQuit 强制退出时的回调函数
 */
export function startTimeoutMonitor(onForceQuit: () => void) {
  // 清除可能存在的计时器
  clearAllTimers();
  
  // 10秒后提示耐心等待
  patientHintTimer = setTimeout(() => {
    wx.showToast({
      title: '处理中，请耐心等待',
      icon: 'none',
      duration: 2000
    });
  }, TIMEOUT_SETTINGS.PATIENT_HINT);
  
  // 15秒后强制退出
  forceQuitTimer = setTimeout(() => {
    wx.hideLoading();
    wx.showModal({
      title: '处理超时',
      content: '图片处理时间过长，请稍后重试',
      showCancel: false
    });
    
    if (onForceQuit) {
      onForceQuit();
    }
  }, TIMEOUT_SETTINGS.FORCE_QUIT);
}

/**
 * 停止超时监控
 */
export function stopTimeoutMonitor() {
  clearAllTimers();
}

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
  
  console.log('当前API配额信息:', quota);
  return quota;
}

/**
 * 更新API使用量并显示友好提示
 */
function updateAPIUsage() {
  const quota = getAPIQuota();
  quota.used += 1;
  wx.setStorageSync('api_quota', quota);
  
  console.log('API使用量已更新:', quota);
  
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
  const canUse = quota.used < quota.total;
  console.log(`API额度检查: ${quota.used}/${quota.total}, 可用: ${canUse}`);
  return canUse;
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
  console.log('开始抠图处理, 图片路径:', imagePath);
  
  return new Promise((resolve, reject) => {
    // 检查API限额
    if (!checkAPIQuota()) {
      console.error('API额度不足，拒绝请求');
      reject(new Error('API调用次数已达到今日限额，请明天再试'));
      return;
    }

    // 显示加载提示
    wx.showLoading({
      title: '处理中...',
      mask: true
    });
    
    console.log('启动超时监控');
    // 启动超时监控
    startTimeoutMonitor(() => {
      console.error('抠图处理超时');
      reject(new Error('处理超时，请稍后重试'));
    });

    // 检查图片路径是否有效
    if (!imagePath || typeof imagePath !== 'string') {
      console.error('无效的图片路径:', imagePath);
      stopTimeoutMonitor();
      wx.hideLoading();
      reject(new Error('无效的图片路径'));
      return;
    }

    console.log('准备压缩图片');
    // 压缩图片再上传，提高性能
    compressImage(imagePath).then(compressedPath => {
      console.log('图片压缩完成, 开始上传:', compressedPath);
      
      // 检查API密钥
      if (!apiKey) {
        console.error('API密钥未提供');
        stopTimeoutMonitor();
        wx.hideLoading();
        reject(new Error('API密钥未提供'));
        return;
      }
      
      // 打印请求信息
      console.log('请求URL:', API_URL);
      console.log('请求头:', {
        'X-Api-Key': `${apiKey.substring(0, 3)}...${apiKey.substring(apiKey.length - 3)}` // 隐藏大部分API密钥
      });
      console.log('请求参数:', { size, format: 'png' });
      
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
          // 停止超时监控
          stopTimeoutMonitor();
          
          console.log('抠图API响应状态:', res.statusCode);
          
          if (res.statusCode === 200) {
            console.log('API响应成功，开始处理返回的图片数据');
            // 更新API使用量
            updateAPIUsage();
            
            try {
              // 获取文件系统管理器，用于文件操作
              const fs = wx.getFileSystemManager();
              
              // 为图片创建一个唯一的临时路径
              const timestamp = Date.now();
              const tempFilePath = `${wx.env.USER_DATA_PATH}/temp_${timestamp}.png`;
              
              console.log('创建临时文件路径:', tempFilePath);
              
              // 验证响应数据是否有效
              console.log('检查响应数据有效性:');
              console.log('响应数据类型:', typeof res.data);
              
              if (!res.data || (typeof res.data === 'string' && res.data.length < 100)) {
                console.error('响应数据异常，可能为空或无效图片数据');
                wx.hideLoading();
                reject(new Error('处理图片数据失败: 服务返回无效数据'));
                return;
              }
              
              // 直接将返回的二进制数据写入文件
              fs.writeFile({
                filePath: tempFilePath,
                data: res.data,
                encoding: 'binary', // 尝试使用binary编码，而不是base64
                success: () => {
                  console.log('写入临时文件成功, 准备保存到文件系统');
                  
                  // 验证临时文件是否有效
                  fs.getFileInfo({
                    filePath: tempFilePath,
                    success: (fileInfo) => {
                      console.log('临时文件大小:', fileInfo.size, '字节');
                      if (fileInfo.size < 100) {
                        console.error('临时文件异常，大小过小:', fileInfo.size);
                        wx.hideLoading();
                        reject(new Error('处理图片数据失败: 临时文件异常'));
                        return;
                      }
                      
                      // 使用文件系统的saveFile而不是wx.saveFile
                      const savedFilePath = `${wx.env.USER_DATA_PATH}/bg_removed_${timestamp}.png`;
                      
                      fs.saveFile({
                        tempFilePath: tempFilePath,
                        filePath: savedFilePath,
                        success: () => {
                          console.log('保存文件成功, 文件路径:', savedFilePath);
                          
                          // 验证保存的文件
                          fs.getFileInfo({
                            filePath: savedFilePath,
                            success: (savedFileInfo) => {
                              console.log('保存文件大小:', savedFileInfo.size, '字节');
                              
                              // 隐藏加载提示
                              wx.hideLoading();
                              
                              // 显示简单图片预览测试成功与否
                              wx.previewImage({
                                urls: [savedFilePath],
                                current: savedFilePath,
                                fail: (err) => {
                                  console.error('预览图片失败，可能图片无效:', err);
                                }
                              });
                              
                              resolve(savedFilePath);
                            },
                            fail: (err) => {
                              console.error('获取保存文件信息失败:', err);
                              wx.hideLoading();
                              resolve(savedFilePath); // 仍然尝试使用
                            }
                          });
                          
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
                          console.log('尝试使用临时文件路径:', tempFilePath);
                          resolve(tempFilePath);
                        }
                      });
                    },
                    fail: (err) => {
                      console.error('获取临时文件信息失败:', err);
                      wx.hideLoading();
                      reject(new Error('处理图片数据失败: 无法验证临时文件'));
                    }
                  });
                },
                fail: (err) => {
                  console.error('写入文件失败', err);
                  console.log('响应数据类型:', typeof res.data);
                  console.log('响应数据长度:', typeof res.data === 'string' ? res.data.length : '未知');
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
            console.error('API返回错误状态码:', res.statusCode);
            let errorMsg = '抠图处理失败';
            wx.hideLoading();
            
            try {
              console.log('尝试解析错误响应:', res.data);
              const error = JSON.parse(res.data);
              errorMsg = error.errors && error.errors[0] ? error.errors[0].title : '抠图处理失败';
              console.log('解析到的错误信息:', errorMsg);
              
              // 检查是否是API额度限制错误
              if (res.statusCode === 429 || (error.errors && error.errors[0] && error.errors[0].code === 'rate_limit_exceeded')) {
                console.log('检测到API额度限制');
                // 强制更新用量为限额
                const quota = getAPIQuota();
                quota.used = quota.total;
                wx.setStorageSync('api_quota', quota);
                errorMsg = 'API调用次数已达到限额，请稍后再试';
              }
            } catch (e) {
              console.error('解析错误信息失败', e);
              console.log('原始响应数据:', res.data);
            }
            
            reject(new Error(errorMsg));
          }
        },
        fail: (err) => {
          // 停止超时监控
          stopTimeoutMonitor();
          
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
      // 停止超时监控
      stopTimeoutMonitor();
      
      console.error('图片压缩失败', err);
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
  console.log('开始压缩图片:', imagePath);
  
  return new Promise((resolve, reject) => {
    // 检查图片路径
    if (!imagePath) {
      console.error('无效的图片路径');
      reject(new Error('无效的图片路径'));
      return;
    }
    
    // 尝试使用wx.compressImage API进行压缩
    wx.compressImage({
      src: imagePath,
      quality: 80, // 中等质量压缩
      success: (res) => {
        console.log('压缩成功, 压缩后路径:', res.tempFilePath);
        resolve(res.tempFilePath);
      },
      fail: (err) => {
        console.warn('wx.compressImage压缩失败, 使用原图:', err);
        // 压缩失败，使用原图
        resolve(imagePath);
      }
    });
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
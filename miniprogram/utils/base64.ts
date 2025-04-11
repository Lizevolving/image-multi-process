/**
 * Base64编码工具函数
 */

/**
 * 用于URL安全的Base64编码
 * 替换标准Base64中的'+'为'-'，'/'为'_'，并去除填充的'='
 * 
 * @param str 要编码的字符串
 * @returns URL安全的Base64编码字符串
 */
export function base64EncodeURL(str: string): string {
  return wx.arrayBufferToBase64(new Uint8Array([...str].map(char => char.charCodeAt(0))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * 将文件路径转换为Base64
 * 
 * @param filePath 文件路径
 * @returns Promise<string> Base64编码后的字符串
 */
export function fileToBase64(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().readFile({
      filePath: filePath,
      encoding: 'base64',
      success: res => {
        resolve(res.data as string);
      },
      fail: err => {
        reject(err);
      }
    });
  });
}

/**
 * 获取图片的MIME类型
 * 
 * @param filePath 图片文件路径
 * @returns Promise<string> MIME类型，如'image/jpeg'
 */
export function getImageMimeType(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    wx.getImageInfo({
      src: filePath,
      success: res => {
        const type = res.type || 'jpeg';
        resolve(`image/${type}`);
      },
      fail: err => {
        // 如果获取失败，默认返回jpeg
        resolve('image/jpeg');
      }
    });
  });
}

/**
 * 将图片文件转换为带MIME类型的Base64字符串
 * 
 * @param filePath 图片文件路径
 * @returns Promise<string> 完整的Base64字符串，带MIME类型前缀
 */
export async function imageToBase64WithMime(filePath: string): Promise<string> {
  try {
    // 获取图片MIME类型
    const mimeType = await getImageMimeType(filePath);
    
    // 获取Base64编码
    const base64Data = await fileToBase64(filePath);
    
    // 返回完整的带MIME类型前缀的Base64字符串
    return `data:${mimeType};base64,${base64Data}`;
  } catch (error) {
    console.error('转换图片到Base64失败:', error);
    throw error;
  }
} 
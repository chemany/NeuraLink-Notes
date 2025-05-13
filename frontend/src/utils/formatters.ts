/**
 * 格式化文件大小，将字节数转换为更易读的格式
 * @param bytes 字节数
 * @returns 格式化后的文件大小字符串
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * 格式化日期，将ISO时间字符串转换为更易读的格式
 * @param dateString ISO格式的时间字符串或已格式化的日期字符串
 * @returns 格式化后的日期字符串
 */
export const formatDate = (dateString: string): string => {
  try {
    // 如果是空值或无效值，返回默认文本
    if (!dateString) {
      return '未知日期';
    }
    
    // 判断是否可能已经是格式化后的中文日期 (包含年月日)
    if (dateString.includes('年') && dateString.includes('月') && dateString.includes('日')) {
      return dateString; // 已经格式化，直接返回
    }
    
    // 尝试转换为日期对象
    const date = new Date(dateString);
    
    // 检查日期是否有效 (Invalid Date会返回NaN)
    if (isNaN(date.getTime())) {
      console.warn('无效的日期格式:', dateString);
      return dateString; // 无效日期，返回原始字符串
    }
    
    // 格式化日期
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  } catch (e) {
    console.error('日期格式化错误:', e);
    return dateString || '未知日期'; // 发生错误返回原始值或默认文本
  }
};

/**
 * 截断文本，添加省略号
 * @param text 要截断的文本
 * @param maxLength 最大长度，默认100
 * @returns 截断后的文本
 */
export const truncateText = (text: string, maxLength: number = 100): string => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  
  return text.substring(0, maxLength) + '...';
};

/**
 * 将时间戳格式化为相对时间（如"刚刚"、"5分钟前"等）
 * @param timestamp 时间戳或ISO日期字符串
 * @returns 相对时间字符串
 */
export const formatRelativeTime = (timestamp: string | number): string => {
  const now = new Date();
  const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return '刚刚';
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分钟前`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}个月前`;
  
  const years = Math.floor(months / 12);
  return `${years}年前`;
}; 
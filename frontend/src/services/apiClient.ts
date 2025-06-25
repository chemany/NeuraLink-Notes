import axios from 'axios';
// 不再需要从 config.ts 获取 URL
// import { getApiBaseUrl } from '../config'; 

/**
 * apiClient 是一个配置了 Authorization 头的 Axios 实例。
 * 它包含一个请求拦截器，自动从 localStorage 获取 token 并添加到请求头中。
 */
/**
 * 获取 API 的基础 URL
 * 在开发环境中直接连接到后端，在生产环境中使用相对路径
 */
export const getApiBaseUrl = (): string => {
  // 检查是否在浏览器环境中
  if (typeof window !== 'undefined') {
    // 在开发环境中，直接连接到后端
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[getApiBaseUrl] Using localhost backend URL');
      }
      return 'http://localhost:3001';
    }
    
    // 在生产环境中使用相对路径，考虑basePath
    if (process.env.NODE_ENV !== 'production') {
      console.log('[getApiBaseUrl] Using relative path for production with basePath');
    }
    return '/notepads';
  }
  
  // 服务端渲染环境下的默认值，也需要考虑basePath
  if (process.env.NODE_ENV !== 'production') {
    console.log('[getApiBaseUrl] Using basePath for SSR');
  }
  return '/notepads';
};

const apiClient = axios.create({
  baseURL: getApiBaseUrl() + '/api',
});

apiClient.interceptors.request.use(
  (config) => {
    // 仅在浏览器环境中尝试访问 localStorage
    if (typeof window !== 'undefined') {
      // 修复：使用正确的令牌键名，与统一设置服务保持一致
      const token = localStorage.getItem('calendar_unified_token');
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
        if (process.env.NODE_ENV !== 'production') {
          console.log('[apiClient] 使用统一认证令牌');
        }
      } else {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[apiClient] 未找到统一认证令牌');
        }
      }
    }
    
    // 确保 FormData 请求不被 application/json Content-Type 覆盖
    if (!(config.data instanceof FormData) && config.headers['Content-Type'] === undefined) {
      config.headers['Content-Type'] = 'application/json';
    }
    config.headers['Accept'] = 'application/json';
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * handleApiError 是一个统一的 API 错误处理函数。
 * @param error - 捕获到的错误对象。
 * @param context - 发生错误的上下文描述（例如，函数名或操作名）。
 * @returns 返回一个 Error 对象，其中包含格式化后的错误消息。
 */
export const handleApiError = (error: any, context: string): Error => {
  console.error(`[${context}] API Error:`, error);
  let message = `An unknown error occurred in ${context}.`;
  if (axios.isAxiosError(error)) {
    if (error.response) {
      // 尝试从 error.response.data.message 获取后端返回的具体错误信息
      // 如果没有，则使用 error.response.statusText 或 error.message
      const serverMessage = error.response.data?.message || error.response.data?.error; // 兼容 'error' 字段
      message = serverMessage || error.response.statusText || error.message;
      message = `API Error in ${context}: ${message} (Status: ${error.response.status})`;
    } else if (error.request) {
      message = `API Error in ${context}: No response received from server. Please check your network connection and the server status.`;
    } else {
      message = `API Error in ${context}: ${error.message}`;
    }
  } else if (error instanceof Error) {
    message = `Error in ${context}: ${error.message}`;
  }
  return new Error(message);
};

export default apiClient; 
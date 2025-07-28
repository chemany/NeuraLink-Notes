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
    const hostname = window.location.hostname;
    const port = window.location.port;

    // 添加详细的调试信息
    console.log('[getApiBaseUrl] 当前hostname:', hostname);
    console.log('[getApiBaseUrl] 当前完整URL:', window.location.href);

    // 检查是否是本地环境（localhost或127.0.0.1）
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

    // 检查是否是局域网IP地址（192.168.x.x, 10.x.x.x, 172.16-31.x.x）
    const isPrivateIP = /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
                       /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
                       /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(hostname);

    console.log('[getApiBaseUrl] isLocalhost:', isLocalhost);
    console.log('[getApiBaseUrl] isPrivateIP:', isPrivateIP);

    // 检查是否通过代理访问（端口8081）
    const isProxyAccess = port === '8081' || hostname.includes('jason.cheman.top');

    if (isLocalhost && port === '3000') {
      // 本地开发环境：直接连接到后端
      console.log('[getApiBaseUrl] 检测到本地开发环境，使用localhost连接');
      return 'http://localhost:3001';
    } else if (isPrivateIP && port === '3000') {
      // 局域网IP直接访问前端：使用当前IP访问后端端口
      const backendUrl = `http://${hostname}:3001`;
      console.log(`[getApiBaseUrl] 检测到局域网直接访问(${hostname}:${port})，使用IP连接:`, backendUrl);
      return backendUrl;
    } else if (isProxyAccess) {
      // 通过代理访问（8081端口或外网域名）：使用nginx代理
      console.log('[getApiBaseUrl] 检测到代理访问，使用nginx代理');
      return '/notepads';
    } else {
      // 其他情况：使用nginx代理
      console.log('[getApiBaseUrl] 检测到外网环境，使用nginx代理');
      return '/notepads';
    }
  }

  // 服务端渲染环境下的默认值 - 在SSR时也使用localhost
  console.log('[getApiBaseUrl] 服务端环境，使用默认配置');
  return 'http://localhost:3001';
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
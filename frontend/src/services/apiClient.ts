import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

/**
 * apiClient 是一个配置了 Authorization 头的 Axios 实例。
 * 它包含一个请求拦截器，自动从 localStorage 获取 token 并添加到请求头中。
 */
const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

apiClient.interceptors.request.use(
  (config) => {
    // 仅在浏览器环境中尝试访问 localStorage
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
      console.log('[ApiClient Interceptor] Token ADDED for URL:', config.url);
    } else {
      console.log('[ApiClient Interceptor] Token NOT FOUND for URL:', config.url);
    }
    // 确保 FormData 请求不被 application/json Content-Type 覆盖
    if (config.data instanceof FormData) {
      // Axios 默认会为 FormData 设置正确的 Content-Type
      // 但如果之前有默认的 Content-Type: application/json，这里可以显式移除或让 Axios 自动处理
      // delete config.headers['Content-Type']; // 或者让 Axios 自动处理
    } else if (config.headers['Content-Type'] === undefined) {
        // 为非 FormData 请求设置默认 Content-Type (如果未显式设置)
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
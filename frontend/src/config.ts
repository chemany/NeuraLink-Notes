/**
 * 统一管理后端API基础地址
 * 兼容本地、内网、外网环境，并能在客户端和服务端安全调用。
 */

/**
 * 获取后端API的基础URL。
 * 在新架构下，前端所有请求都发往其自身的源（origin），
 * 由反向代理根据路径（例如 /api）来决定是否转发到后端服务。
 * 这样可以避免CORS问题，并隐藏后端具体地址和端口。
 * @returns {string} API基础URL，即当前页面的源。
 */
export function getApiBaseUrl(): string {
  // 在浏览器中，返回当前页面的源 (e.g., http://localhost:3000 or https://jason.cheman.top)
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  // 服务器端渲染 (SSR) 或其他Node.js环境
  // 返回一个可配置的默认值，主要用于服务端发起的请求（如果存在）
  return process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3000';
} 
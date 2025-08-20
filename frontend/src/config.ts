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
  // 在浏览器中，根据环境决定API地址
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    
    // 检查是否是本地环境
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    
    // 检查是否是局域网IP地址
    const isPrivateIP = /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
                       /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
                       /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(hostname);
    
    if (isLocalhost) {
      // 本地开发环境，直接连接到后端端口
      console.log(`[NeuraLink API Config] 检测到本地环境(${hostname})，直接连接3001端口`);
      return 'http://localhost:3001';
    } else if (isPrivateIP) {
      // 局域网环境，使用当前IP连接到后端端口
      console.log(`[NeuraLink API Config] 检测到局域网环境(${hostname})，使用IP连接3001端口`);
      return `http://${hostname}:3001`;
    } else if (hostname === 'www.cheman.top' || hostname === 'cheman.top') {
      // 外网cheman.top域名，通过隧道API路由访问
      console.log(`[NeuraLink API Config] 检测到cheman.top域名(${hostname})，通过隧道API路由访问`);
      return `${protocol}//${hostname}/notepads/api`;
    } else {
      // 其他外网环境，使用当前源
      console.log(`[NeuraLink API Config] 检测到其他外网环境(${hostname})，使用当前源`);
      return window.location.origin;
    }
  }

  // 服务器端渲染 (SSR) 或其他Node.js环境
  // 返回一个可配置的默认值，主要用于服务端发起的请求（如果存在）
  return process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001';
} 
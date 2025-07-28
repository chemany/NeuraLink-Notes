/**
 * 智能导航工具函数
 * 根据当前访问方式决定跳转到正确的首页
 */

import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

/**
 * 智能跳转到首页
 * @param router - Next.js router 实例
 * @param fallbackPath - 备用路径，默认为 '/'
 */
export const navigateToHome = (router: AppRouterInstance, fallbackPath: string = '/') => {
  console.log('[Navigation] 智能导航到首页');

  try {
    // 智能检测当前访问方式，决定跳转到哪里
    if (typeof window !== 'undefined') {
      const port = window.location.port;
      const hostname = window.location.hostname;
      const pathname = window.location.pathname;

      // 检查是否通过代理访问（8081端口或外网域名）
      const isProxyAccess = port === '8081' || hostname.includes('jason.cheman.top');

      if (isProxyAccess) {
        // 通过代理访问，检查当前路径
        if (pathname.startsWith('/notepads')) {
          // 已经在 /notepads 路径下，跳转到 /notepads（不带尾部斜杠）
          console.log('[Navigation] 检测到代理访问且在notepads路径下，跳转到 /notepads');
          router.push('/notepads');
        } else {
          // 不在 /notepads 路径下，跳转到 /notepads/
          console.log('[Navigation] 检测到代理访问，跳转到 /notepads/');
          router.push('/notepads/');
        }
      } else {
        // 直接访问前端，跳转到根路径或指定的备用路径
        console.log('[Navigation] 检测到直接访问，跳转到', fallbackPath);
        router.push(fallbackPath);
      }
    } else {
      // 服务端环境，使用备用路径
      router.push(fallbackPath);
    }
  } catch (error) {
    console.error('[Navigation] 导航错误:', error);
    // 发生错误时使用备用路径
    router.push(fallbackPath);
  }
};

/**
 * 检测当前是否通过代理访问
 * @returns boolean - 是否通过代理访问
 */
export const isProxyAccess = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  const port = window.location.port;
  const hostname = window.location.hostname;
  
  return port === '8081' || hostname.includes('jason.cheman.top');
};

/**
 * 获取当前环境的首页路径
 * @returns string - 首页路径
 */
export const getHomePath = (): string => {
  if (typeof window !== 'undefined') {
    const pathname = window.location.pathname;
    if (isProxyAccess()) {
      // 如果已经在 /notepads 路径下，返回 /notepads，否则返回 /notepads/
      return pathname.startsWith('/notepads') ? '/notepads' : '/notepads/';
    }
  }
  return '/';
};

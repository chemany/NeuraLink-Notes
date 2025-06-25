'use client';

// frontend/src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation'; // <--- 更改导入
import { User } from '@/types'; // 导入 User 类型
import unifiedSettingsService from '@/services/unifiedSettingsService';

interface AuthContextType {
  token: string | null;
  user: User | null; // 使用具体的 User 类型
  isAuthenticated: boolean;
  isLoading: boolean; // 初始加载状态，用于判断是否已尝试加载token和用户信息
  login: (accessToken: string, userData: User) => void; // userData 现在是必需的 User 类型
  logout: () => void;
  // 统一设置服务登录方法
  loginWithUnifiedService: (email: string, password: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true); // 开始时设为true，直到token和用户信息加载完毕
  const router = useRouter();

  useEffect(() => {
    console.log('[AuthContext] 开始自动登录检查，仅使用统一设置服务');
    const attemptAutoLogin = async () => {
      try {
        // 仅检查统一设置服务的令牌验证
        const unifiedLoggedIn = unifiedSettingsService.isLoggedIn();
        console.log('[AuthContext] 统一设置服务登录状态:', unifiedLoggedIn);
        
        if (unifiedLoggedIn) {
          console.log('[AuthContext] 验证统一设置服务令牌');
          const unifiedAuth = await unifiedSettingsService.verifyToken();
          
          if (unifiedAuth.valid) {
            console.log('[AuthContext] 统一设置服务令牌有效，获取用户信息');
            const unifiedUser = await unifiedSettingsService.getCurrentUser();
            
            if (unifiedUser.user) {
              console.log('[AuthContext] 同步统一服务用户到本地认证状态');
              setUser(unifiedUser.user as User);
              setToken(unifiedSettingsService.getToken() || 'unified-service-token');
            }
          } else {
            console.log('[AuthContext] 统一设置服务令牌无效，清除令牌');
            unifiedSettingsService.clearToken();
            localStorage.removeItem('token'); // 清除本地token
          }
        } else {
          console.log('[AuthContext] 未登录统一设置服务');
          // 清除任何残留的本地认证状态
          localStorage.removeItem('token');
          setToken(null);
          setUser(null);
        }
      } catch (error) {
        console.error('[AuthContext] 统一设置服务认证检查失败:', error);
        // 清除认证状态
        unifiedSettingsService.clearToken();
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
      }
      
      setIsLoading(false);
      console.log('[AuthContext] 自动登录检查完成，加载状态设为false');
    };

    attemptAutoLogin();
  }, []); // 空依赖数组，仅在挂载时运行一次

  const login = useCallback((accessToken: string, userData: User) => {
    console.log('[AuthContext] 登录回调被调用，Token:', accessToken, '用户数据:', userData);
    localStorage.setItem('token', accessToken);
    setToken(accessToken);
    setUser(userData);
    console.log('[AuthContext] 登录后状态 - Token:', accessToken, 'User:', userData);
  }, []);

  // 使用统一设置服务登录
  const loginWithUnifiedService = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      console.log('[AuthContext] 尝试使用统一设置服务登录');
      const result = await unifiedSettingsService.login(email, password);
      
      if (result.accessToken && result.user) {
        console.log('[AuthContext] 统一设置服务登录成功');
        // 同步到本地认证状态
        setToken(result.accessToken);
        setUser(result.user as User);
        localStorage.setItem('token', result.accessToken);
        
        return true;
      } else {
        console.error('[AuthContext] 统一设置服务登录失败: 未返回令牌或用户');
        return false;
      }
    } catch (error) {
      console.error('[AuthContext] 统一设置服务登录错误:', error);
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    console.log('[AuthContext] 开始登出流程');
    
    // 登出统一设置服务
    try {
      await unifiedSettingsService.logout();
      console.log('[AuthContext] 统一设置服务登出成功');
    } catch (error) {
      console.error('[AuthContext] 统一设置服务登出错误:', error);
    }
    
    // 清除本地状态
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    
    // 跳转到登录页面
    router.push('/auth/login'); 
    console.log('[AuthContext] 登出后状态 - Token: null, User: null');
  }, [router]);

  const isAuthenticatedValue = !!token && !!user;
  // 仅在非生产环境输出详细日志
  if (process.env.NODE_ENV !== 'production') {
    console.log('[AuthContext] Provider渲染中，Token:', token ? '已设置' : '未设置', 'User:', user?.email || '未设置', 'IsAuthenticated:', isAuthenticatedValue, 'IsLoading:', isLoading);
  }

  const contextValue = useMemo(() => ({
    token,
    user,
    isAuthenticated: isAuthenticatedValue,
    isLoading,
    login,
    logout,
    loginWithUnifiedService
  }), [token, user, isAuthenticatedValue, isLoading, login, logout, loginWithUnifiedService]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  // 仅在非生产环境输出详细日志
  if (process.env.NODE_ENV !== 'production') {
    console.log('[AuthContext] useAuth钩子调用，返回上下文:', context?.isAuthenticated, context?.isLoading, context?.user?.email);
  }
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 
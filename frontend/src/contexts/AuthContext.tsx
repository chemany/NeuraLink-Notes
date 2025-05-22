'use client';

// frontend/src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation'; // <--- 更改导入
import { User } from '@/types'; // 导入 User 类型
import { getProfile } from '@/services/authService'; // 导入 getProfile 服务

interface AuthContextType {
  token: string | null;
  user: User | null; // 使用具体的 User 类型
  isAuthenticated: boolean;
  isLoading: boolean; // 初始加载状态，用于判断是否已尝试加载token和用户信息
  login: (accessToken: string, userData: User) => void; // userData 现在是必需的 User 类型
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true); // 开始时设为true，直到token和用户信息加载完毕
  const router = useRouter();

  useEffect(() => {
    console.log('[AuthContext] useEffect for auto-login triggered.');
    const attemptAutoLogin = async () => {
      const storedToken = localStorage.getItem('token');
      console.log('[AuthContext] Stored token from localStorage:', storedToken);
      if (storedToken) {
        setToken(storedToken); // 先设置token，让apiClient可以使用
        try {
          console.log('[AuthContext] Attempting to get profile with token:', storedToken);
          const currentUser = await getProfile(); 
          console.log('[AuthContext] Profile fetched successfully:', currentUser);
          setUser(currentUser);
        } catch (error) {
          console.error('[AuthContext] Auto-login getProfile failed (token might be expired/invalid):', error);
          localStorage.removeItem('token'); // 移除无效token
          setToken(null);
          setUser(null);
          // 根据需要，可以考虑是否在此处强制跳转到登录页
          // router.push('/auth/login');
        }
      }
      setIsLoading(false);
      console.log('[AuthContext] Finished auto-login attempt. isLoading set to false.');
    };

    attemptAutoLogin();
  }, []); // 空依赖数组，仅在挂载时运行一次

  const login = useCallback((accessToken: string, userData: User) => {
    console.log('[AuthContext] login called. Token:', accessToken, 'User Data:', userData);
    localStorage.setItem('token', accessToken);
    setToken(accessToken);
    setUser(userData);
    console.log('[AuthContext] State after login - Token:', accessToken, 'User:', userData);
    // 登录成功后，跳转通常在调用 login 的地方处理 (例如登录页面)
    // router.push('/'); 
  }, []);

  const logout = useCallback(() => {
    console.log('[AuthContext] logout called.');
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    // 登出后跳转到登录页面
    // 确保路径与你的登录页面路由一致
    router.push('/auth/login'); 
    console.log('[AuthContext] State after logout - Token: null, User: null');
  }, [router]);

  const isAuthenticatedValue = !!token && !!user;
  console.log('[AuthContext] Provider rendering. Token:', token, 'User:', user, 'IsAuthenticated:', isAuthenticatedValue, 'IsLoading:', isLoading);

  const contextValue = useMemo(() => ({
    token,
    user,
    isAuthenticated: isAuthenticatedValue,
    isLoading,
    login,
    logout
  }), [token, user, isAuthenticatedValue, isLoading, login, logout]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  console.log('[AuthContext] useAuth hook called, returning context:', context?.isAuthenticated, context?.isLoading, context?.user?.email);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 
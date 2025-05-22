'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { loginUser as loginUserService } from '@/services/authService';

/**
 * 登录页面组件
 */
const LoginPage = () => {
  const router = useRouter();
  const { login: loginContext, isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  useEffect(() => {
    // Simplified logic for registered query param
    if (typeof window !== 'undefined') {
      const queryParams = new URLSearchParams(window.location.search);
      if (queryParams.get('registered') === 'true') {
        setRegistrationSuccess(true);
        // Optionally remove the query param to prevent re-showing on refresh
        // router.replace('/auth/login', { scroll: false }); 
      }
    }
  }, [router]);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    setRegistrationSuccess(false);

    if (!email.trim() || !password) {
      setError('邮箱和密码不能为空。');
      setIsLoading(false);
      return;
    }

    const loginData = { email, password };

    try {
      const { accessToken, user } = await loginUserService(loginData);
      if (accessToken && user) {
        loginContext(accessToken, user);
      } else {
        setError('登录失败，未能获取到必要信息。');
      }
    } catch (err: any) {
      if (err.response && err.response.status === 401) {
        setError('邮箱或密码错误，请重试。');
      } else {
        setError(err.message || '登录失败，请重试。');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-sky-100 p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-800">欢迎回来</h1>
          <p className="text-sm text-gray-500 mt-1">登录您的灵枢笔记账户</p>
        </div>

        {registrationSuccess && (
          <div className="bg-green-50 border border-green-300 text-green-700 px-4 py-3 rounded-md text-sm" role="alert">
            <p>注册成功！现在您可以登录了。</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              邮箱地址
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out sm:text-sm"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              密码
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              inputMode="url" // 提示英文键盘
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out sm:text-sm"
              placeholder="请输入密码"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-md text-sm" role="alert">
              <p>{error}</p>
            </div>
          )}

          <div>
            <button 
              type="submit" 
              disabled={isLoading || isAuthenticated}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-300 disabled:cursor-not-allowed transition duration-150 ease-in-out"
            >
              {isLoading ? '登录中...' : (isAuthenticated ? '已登录' : '登录')}
            </button>
          </div>
        </form>

        <p className="text-sm text-center text-gray-500">
          还没有账户?{' '}
          <Link href="/auth/register" className="font-medium text-blue-600 hover:text-blue-500 hover:underline">
            立即注册
          </Link>
        </p>
      </div>
      <footer className="mt-8 text-center text-xs text-gray-500">
        <p>&copy; {new Date().getFullYear()} 灵枢笔记项目. 保留所有权利.</p>
      </footer>
    </div>
  );
};

export default LoginPage; 
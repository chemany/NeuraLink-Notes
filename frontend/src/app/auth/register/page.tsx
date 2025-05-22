'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { registerUser } from '@/services/authService';
import { RegisterUserDto } from '@/types';

/**
 * 注册页面组件
 */
const RegisterPage = () => {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    console.log('[RegisterPage] handleSubmit started.');

    if (!username.trim() || !email.trim() || !password) {
      setError('用户名、邮箱和密码不能为空。');
      setIsLoading(false);
      console.log('[RegisterPage] Validation failed: fields empty.');
      return;
    }

    const registerData: RegisterUserDto = { username, email, password };
    console.log('[RegisterPage] Attempting to register with data:', registerData);

    try {
      await registerUser(registerData);
      console.log('[RegisterPage] registerUser API call successful.');
      setError(null);
      console.log('[RegisterPage] Attempting to navigate to /auth/login?registered=true');
      
      router.push('/auth/login?registered=true');
      console.log('[RegisterPage] router.push call initiated.');

    } catch (err: any) {
      console.error('[RegisterPage] Error during registration or navigation:', err);
      if (err.response && err.response.status === 409) {
        setError('用户名或邮箱已被注册，请尝试其他用户名或邮箱。');
      } else if (err.message && (typeof err.message === 'string' && err.message.toLowerCase().includes('navigation')) || (err.name && typeof err.name === 'string' && err.name.toLowerCase().includes('navigationerror'))) {
        setError('注册成功，但页面跳转遇到问题: ' + err.message);
      } else {
        setError(err.message || '注册失败，请重试。');
      }
    } finally {
      setIsLoading(false);
      console.log('[RegisterPage] handleSubmit finished. isLoading set to false.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-sky-100 to-slate-100 p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-800">创建您的账户</h1>
          <p className="text-sm text-gray-500 mt-1">加入灵枢笔记</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
              用户名
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out sm:text-sm"
              placeholder="选择一个用户名"
            />
          </div>

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
              inputMode="url"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out sm:text-sm"
              placeholder="创建一个安全的密码"
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
              disabled={isLoading}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-300 disabled:cursor-not-allowed transition duration-150 ease-in-out"
            >
              {isLoading ? '注册中...' : '创建账户'}
            </button>
          </div>
        </form>

        <p className="text-sm text-center text-gray-500">
          已有账户?{' '}
          <Link href="/auth/login" className="font-medium text-blue-600 hover:text-blue-500 hover:underline">
            立即登录
          </Link>
        </p>
      </div>
      <footer className="mt-8 text-center text-xs text-gray-500">
        <p>&copy; {new Date().getFullYear()} 灵枢笔记项目. 保留所有权利.</p>
      </footer>
    </div>
  );
};

export default RegisterPage; 
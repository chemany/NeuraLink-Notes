'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import unifiedSettingsService from '@/services/unifiedSettingsService';

/**
 * 注册页面组件 - 完全使用统一设置服务
 */
const RegisterPage = () => {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 前端验证
  const validateInputs = () => {
    if (!username.trim() || !email.trim() || !password || !confirmPassword) {
      setError('所有字段都不能为空。');
      return false;
    }

    // 用户名验证
    if (username.length < 3 || username.length > 20) {
      setError('用户名长度应在3-20个字符之间。');
      return false;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setError('用户名只能包含字母、数字和下划线。');
      return false;
    }

    // 邮箱验证
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('请输入有效的邮箱地址。');
      return false;
    }

    // 密码验证
    if (password.length < 6) {
      setError('密码至少需要6个字符。');
      return false;
    }

    if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(password)) {
      setError('密码必须包含至少一个字母和一个数字。');
      return false;
    }

    // 确认密码验证
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致，请重新输入。');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    // 前端验证
    if (!validateInputs()) {
      return;
    }

    setIsLoading(true);
    console.log('[RegisterPage] 开始使用统一设置服务注册');

    const registerData = { username, email, password };
    console.log('[RegisterPage] 尝试使用统一设置服务注册:', { username, email });

    try {
      const result = await unifiedSettingsService.register(registerData);
      console.log('[RegisterPage] 统一设置服务注册成功:', result);
      
      setError(null);
      console.log('[RegisterPage] 正在跳转到登录页面');
      
      router.push('/auth/login?registered=true');
      console.log('[RegisterPage] 页面跳转已启动');

    } catch (err: any) {
      console.error('[RegisterPage] 注册错误:', err);
      if (err.message?.includes('邮箱已被注册') || err.message?.includes('用户名已被使用')) {
        setError('用户名或邮箱已被注册，请尝试其他用户名或邮箱。');
      } else if (err.message?.includes('输入数据验证失败')) {
        setError('输入数据不符合要求，请检查用户名和密码格式。');
      } else if (err.message?.includes('网络错误') || err.message?.includes('无法连接')) {
        setError('无法连接到统一设置服务，请检查网络连接或稍后重试。');
      } else {
        setError(err.message || '注册失败，请重试。');
      }
    } finally {
      setIsLoading(false);
      console.log('[RegisterPage] 注册流程结束，加载状态已设为false');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-sky-100 to-slate-100 p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-800">创建您的统一账户</h1>
          <p className="text-sm text-gray-500 mt-1">加入统一设置服务</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
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
              placeholder="3-20个字符，仅支持字母、数字、下划线"
            />
            <p className="text-xs text-gray-500 mt-1">用户名只能包含字母、数字和下划线，长度3-20字符</p>
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
              autoComplete="new-password"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out sm:text-sm"
              placeholder="至少6个字符，包含字母和数字"
            />
            <p className="text-xs text-gray-500 mt-1">密码至少6个字符，必须包含至少一个字母和一个数字</p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
              确认密码
            </label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              className={`w-full px-4 py-2.5 border rounded-lg shadow-sm transition duration-150 ease-in-out sm:text-sm ${
                confirmPassword && password !== confirmPassword 
                  ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                  : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
              }`}
              placeholder="请再次输入密码"
            />
            {confirmPassword && password !== confirmPassword && (
              <p className="text-xs text-red-600 mt-1">密码不一致</p>
            )}
            {confirmPassword && password === confirmPassword && confirmPassword.length > 0 && (
              <p className="text-xs text-green-600 mt-1">✓ 密码一致</p>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-md text-sm" role="alert">
              <p>{error}</p>
            </div>
          )}

          <div>
            <button 
              type="submit" 
              disabled={isLoading || (password.length > 0 && confirmPassword.length > 0 && password !== confirmPassword)}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-300 disabled:cursor-not-allowed transition duration-150 ease-in-out"
            >
              {isLoading ? '注册中...' : '创建统一账户'}
            </button>
          </div>
        </form>

        <p className="text-sm text-center text-gray-500">
          已有账户?{' '}
          <Link href="/auth/login" className="font-medium text-blue-600 hover:text-blue-500 hover:underline">
            立即登录
          </Link>
        </p>
        
        {/* 服务状态提示 */}
        <div className="text-xs text-center text-gray-500 bg-blue-50 p-3 rounded-md">
          <p>🔐 您的账户将由统一设置服务安全管理</p>
          <p>🌐 支持智能日历和灵枢笔记的无缝切换</p>
        </div>
      </div>
      <footer className="mt-8 text-center text-xs text-gray-500">
        <p>&copy; {new Date().getFullYear()} 灵枢笔记项目. 保留所有权利.</p>
      </footer>
    </div>
  );
};

export default RegisterPage; 
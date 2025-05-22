import apiClient, { handleApiError } from './apiClient';
import { LoginUserDto, RegisterUserDto } from '@/types'; // 假设这些类型已在 types.ts 或类似文件中定义
import axios from 'axios';

/**
 * 注册新用户
 * @param registerData - 包含用户名、邮箱和密码的对象
 * @returns Promise<any> - 后端返回的用户数据或成功消息
 */
export const registerUser = async (registerData: RegisterUserDto): Promise<any> => {
  try {
    const response = await apiClient.post('/api/auth/register', registerData);
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'registerUser');
  }
};

/**
 * 用户登录
 * @param loginData - 包含邮箱和密码的对象
 * @returns Promise<{ accessToken: string; user: any }〉 - 后端返回的包含 token 和用户信息的对象
 */
export const loginUser = async (loginData: LoginUserDto): Promise<{ accessToken: string; user: any }> => {
  try {
    const response = await apiClient.post<{ accessToken: string; user: any }>('/api/auth/login', loginData);
    if (response.data && response.data.accessToken) {
      // 登录成功后，将 token 存储到 localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', response.data.accessToken);
      }
    }
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'loginUser');
  }
};

/**
 * 用户登出
 * 清除 localStorage 中的 token
 */
export const logoutUser = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('token');
    // 根据需要，可能还需要清除其他用户相关的 localStorage 数据或重置应用状态
  }
  // 通常在这里还会重定向到登录页或首页
  // window.location.href = '/login';
};

/**
 * 获取当前登录用户的个人资料 (示例)
 * @returns Promise<any> - 后端返回的用户资料
 */
export const getProfile = async (): Promise<any> => {
  try {
    const response = await apiClient.get('/api/auth/profile');
    return response.data;
  } catch (error) {
    // 如果是401错误，可能意味着token无效或过期，可以在这里处理登出逻辑
    if (axios.isAxiosError(error) && error.response && error.response.status === 401) {
      logoutUser(); // 示例：自动登出
      // 可选择抛出特定错误或重定向
      // throw new Error('Session expired. Please login again.'); 
    }
    throw handleApiError(error, 'getProfile');
  }
}; 
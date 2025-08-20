import { getApiBaseUrl, handleApiError } from './apiClient';
import { Notebook } from '@/types';

/**
 * Notebook Service
 *
 * 用于管理笔记本。
 * 主要功能:
 * - 获取所有笔记本
 * - 创建新笔记本
 * - 删除笔记本
 * - 更新笔记本标题
 */

// 获取所有笔记本
export const getAllNotebooks = async (): Promise<Notebook[]> => {
  try {
    // 添加调试信息 - 使用统一的token键名
    const token = typeof window !== 'undefined' ? localStorage.getItem('calendar_unified_token') : null;
    console.log('[getAllNotebooks] Token from localStorage:', token ? `${token.substring(0, 20)}...` : 'null');
    
    const response = await fetch(`${getApiBaseUrl()}/api/notebooks`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('获取笔记本失败:', response.status, errorData);
      throw new Error(`获取笔记本失败: ${errorData.message || response.statusText}`);
    }
    
    const data = await response.json();
    console.log('[getAllNotebooks] API response:', data);
    return data;
  } catch (error) {
    console.error('获取笔记本失败:', (error as any).response?.data || error);
    console.error('获取笔记本时出错:', error);
    throw handleApiError(error, 'getAllNotebooks');
  }
};

// 创建新笔记本
export const createNotebook = async (title: string, folderId: string | undefined, token: string) => {
  try {
    const requestBody: { title: string; folderId?: string } = { title };
    if (folderId) {
      requestBody.folderId = folderId;
    }
    
    const response = await fetch(`${getApiBaseUrl()}/api/notebooks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('创建笔记本失败:', response.status, errorData);
      throw new Error(`创建笔记本失败: ${errorData.message || response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('创建笔记本时出错:', error);
        throw error;
  }
};

// 删除笔记本
export const deleteNotebook = async (id: string, token: string) => {
  try {
    const baseUrl = getApiBaseUrl();
    const fullUrl = `${baseUrl}/api/notebooks/${id}`;
    console.log('[deleteNotebook] 使用的API基础URL:', baseUrl);
    console.log('[deleteNotebook] 完整请求URL:', fullUrl);
    console.log('[deleteNotebook] 笔记本ID:', id);

    const response = await fetch(fullUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('删除笔记本失败:', response.status, errorData);
      throw new Error(`删除笔记本失败: ${errorData.message || response.statusText}`);
    }
    // DELETE请求可能没有响应体
    return { success: true };
  } catch (error) {
    console.error('删除笔记本时出错:', error);
      throw error;
  }
};

// 更新笔记本标题
export const updateNotebookTitle = async (id: string, title: string, token: string) => {
  try {
    const url = `${getApiBaseUrl()}/api/notebooks/${id}`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('更新笔记本标题失败:', response.status, errorData);
      throw new Error(`更新笔记本标题失败: ${errorData.message || response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('更新笔记本标题时出错:', error);
    throw error;
  }
};

// 通用的更新笔记本函数
export const updateNotebook = async (id: string, updates: { title?: string; folderId?: string | null; notes?: string }, token: string) => {
  try {
    const url = `${getApiBaseUrl()}/api/notebooks/${id}`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('更新笔记本失败:', response.status, errorData);
      throw new Error(`更新笔记本失败: ${errorData.message || response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('更新笔记本时出错:', error);
    throw error;
  }
};
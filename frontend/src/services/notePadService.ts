import { getApiBaseUrl } from './apiClient';

/**
 * NotePad Service
 *
 * 用于管理笔记本内的笔记。
 * 主要功能:
 * - 获取指定笔记本的所有笔记
 * - 在指定笔记本中创建新笔记
 * - 获取单个笔记的详细信息
 * - 更新笔记内容
 * - 删除笔记
 */

// 获取指定笔记本的所有笔记
export const getNotesByNotebookId = async (notebookId: string, token: string) => {
  if (!notebookId) {
    console.warn('[notePadService] getNotesByNotebookId: notebookId is empty. Returning empty array.');
    return [];
  }
  if (!token) {
    console.warn('[notePadService] getNotesByNotebookId: token is empty. Returning empty array.');
    return [];
  }
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/notebooks/${notebookId}/notes`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`获取笔记列表失败: ${errorData.message || response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('获取笔记列表时出错:', error);
    throw error;
  }
};

// 在指定笔记本中创建新笔记
export const createNoteInNotebook = async (notebookId: string, title: string, content: string, token: string) => {
  if (!notebookId) {
    throw new Error('笔记本ID不能为空');
  }
  if (!token) {
    throw new Error('认证令牌不能为空');
  }
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/notebooks/${notebookId}/notes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, content }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`创建笔记失败: ${errorData.message || response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('创建笔记时出错:', error);
    throw error;
  }
};

// 获取单个笔记的详细信息
export const getNoteById = async (notebookId: string, noteId: string, token: string) => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/notebooks/${notebookId}/notes/${noteId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`获取笔记失败: ${errorData.message || response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('获取笔记时出错:', error);
    throw error;
  }
};

// 更新笔记内容
export const updateNote = async (notebookId: string, noteId: string, title: string, content: string, token: string) => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/notebooks/${notebookId}/notes/${noteId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, content }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`更新笔记失败: ${errorData.message || response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('更新笔记时出错:', error);
    throw error;
  }
};

// 删除笔记
export const deleteNote = async (notebookId: string, noteId: string, token: string) => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/notebooks/${notebookId}/notes/${noteId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`删除笔记失败: ${errorData.message || response.statusText}`);
    }
    
    // DELETE 请求可能没有响应体
    return { success: true };
  } catch (error) {
    console.error('删除笔记时出错:', error);
    throw error;
  }
};
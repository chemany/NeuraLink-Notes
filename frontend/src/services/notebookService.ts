import { Notebook } from '../types'; // 或者 '../types/notebook'，取决于你保存接口的文件

// 和 documentService.ts 一样，从环境变量或常量获取基础 URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

// 添加简单的错误处理函数
const handleApiError = (error: any, message: string) => {
  console.error(`[API Error] ${message}:`, error);
  throw error instanceof Error ? error : new Error(message);
};

/**
 * 调用后端 API 创建一个新的笔记本
 * @param title 新笔记本的标题
 * @param folderId 可选的文件夹 ID
 * @returns Promise<Notebook> 返回后端创建的笔记本对象
 */
export const createNotebookApi = async (title: string, folderId?: string): Promise<Notebook> => {
  console.log(`[notebookService] Calling API to create notebook with title: ${title}${folderId ? `, folderId: ${folderId}` : ''}`);
  try {
    const response = await fetch(`${API_BASE_URL}/api/notebooks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      // 只发送必要的字段，后端 DTO 会处理
      body: JSON.stringify({ title, folderId }),
    });

    if (!response.ok) {
      // 尝试解析错误信息
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      console.error('[notebookService] Error creating notebook via API:', errorData);
      // 返回更具体的错误信息给调用者
      throw new Error(`API Error: ${errorData.message || response.statusText}`);
    }

    const newNotebook: Notebook = await response.json();
    console.log('[notebookService] Successfully created notebook via API:', newNotebook);
    return newNotebook;

  } catch (error) {
    console.error('[notebookService] Unexpected error during notebook creation API call:', error);
    // 向上抛出错误，让调用者（如 Context）处理 UI 反馈
    if (error instanceof Error) {
        throw error; // 重新抛出原始错误或包装后的错误
    } else {
        throw new Error('An unexpected error occurred during notebook creation.');
    }
  }
};

/**
 * 调用后端 API 获取所有笔记本列表
 * @returns Promise<Notebook[]> 返回笔记本数组
 */
export const fetchNotebooksApi = async (): Promise<Notebook[]> => {
  console.log('[notebookService] Calling API to fetch all notebooks...');
  try {
    const response = await fetch(`${API_BASE_URL}/api/notebooks`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      console.error('[notebookService] Error fetching notebooks via API:', errorData);
      throw new Error(`Failed to fetch notebooks: ${errorData.message || response.statusText}`);
    }

    const notebooks: Notebook[] = await response.json();
    console.log(`[notebookService] Successfully fetched ${notebooks.length} notebooks via API.`);
    return notebooks;

  } catch (error) {
    console.error('[notebookService] Unexpected error during notebook fetch API call:', error);
    if (error instanceof Error) {
        throw error;
    } else {
        throw new Error('An unexpected error occurred while fetching notebooks.');
    }
  }
};

/**
 * 更新笔记本信息
 * @param id 笔记本ID
 * @param data 需要更新的数据 (title和/或folderId)
 * @returns Promise<Notebook> 返回更新后的笔记本对象
 */
export const updateNotebookApi = async (id: string, data: { title?: string; folderId?: string | null; notes?: string }): Promise<Notebook> => {
  console.log(`[notebookService] Calling API to update notebook ${id} with data:`, { title: data.title, folderId: data.folderId, notesProvided: data.notes !== undefined }); // Log differently to avoid logging full notes
  try {
    const response = await fetch(`${API_BASE_URL}/api/notebooks/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      console.error('[notebookService] Error updating notebook via API:', errorData);
      throw new Error(`API Error: ${errorData.message || response.statusText}`);
    }

    const updatedNotebook: Notebook = await response.json();
    console.log('[notebookService] Successfully updated notebook via API:', updatedNotebook);
    return updatedNotebook;
  } catch (error) {
    console.error('[notebookService] Unexpected error during notebook update API call:', error);
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('更新笔记本时出现意外错误');
    }
  }
};

/**
 * 更新笔记本的标题
 * @param id - 笔记本 ID
 * @param title - 新的标题
 * @returns 更新后的笔记本对象
 */
export const updateNotebookTitle = async (id: string, title: string): Promise<Notebook> => {
  console.log(`[notebookService] 更新笔记本标题, ID: ${id}, 新标题: ${title}`);
  const url = `${API_BASE_URL}/api/notebooks/${id}`; // 使用 API_BASE_URL 代替 getApiUrl()
  try {
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        // 可能需要认证头
      },
      body: JSON.stringify({ title }), // 只发送 title
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: '无法解析错误信息' }));
      console.error(`[notebookService] 更新标题失败: ${response.status}`, errorData);
      throw new Error(`HTTP error ${response.status}: ${errorData.message || '更新笔记本标题失败'}`);
    }
    const updatedNotebook: Notebook = await response.json();
    console.log('[notebookService] 笔记本标题更新成功:', updatedNotebook);
    return updatedNotebook;
  } catch (error) {
    handleApiError(error, '更新笔记本标题时发生错误');
    throw error;
  }
};

// 未来可以添加其他笔记本相关的 API 调用函数
// export const deleteNotebookApi = async (id: string): Promise<void> => { ... }
// export const updateNotebookApi = async (id: string, data: Partial<Notebook>): Promise<Notebook> => { ... }

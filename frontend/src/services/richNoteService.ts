import axios from 'axios';
import { Note } from '@/types'; // 确保 Note 类型已从 types 导入（现在是更新后的富文本 Note 类型）

// 从环境变量或默认值获取后端 API 基础 URL
const BACKEND_API_BASE = process.env.NEXT_PUBLIC_BACKEND_API_BASE || 'http://localhost:3001';

// 统一的错误处理函数 (可以从其他 service 文件中复用或单独定义)
const handleApiError = (error: any, context: string): Error => {
  console.error(`[${context}] API Error:`, error);
  let message = `An unknown error occurred in ${context}.`;
  if (axios.isAxiosError(error)) {
    if (error.response) {
      // 后端返回了具体的错误信息
      message = error.response.data?.message || error.response.statusText || error.message;
      message = `API Error in ${context}: ${message} (Status: ${error.response.status})`;
    } else if (error.request) {
      message = `API Error in ${context}: No response received from server.`;
    } else {
      message = `API Error in ${context}: ${error.message}`;
    }
  } else if (error instanceof Error) {
    message = `Error in ${context}: ${error.message}`;
  }
  return new Error(message);
};

/**
 * 工具函数：将后端返回的 Note 对象的 contentJson 字段从字符串解析为对象，并统一时间字段为字符串
 * @param note 后端返回的 Note 对象
 * @returns 处理后的 Note 对象
 */
function normalizeNote(note: any): Note {
  return {
    ...note,
    createdAt: typeof note.createdAt === 'string' ? note.createdAt : new Date(note.createdAt).toISOString(),
    updatedAt: typeof note.updatedAt === 'string' ? note.updatedAt : new Date(note.updatedAt).toISOString(),
    contentJson: typeof note.contentJson === 'string' && note.contentJson
      ? JSON.parse(note.contentJson)
      : note.contentJson,
  };
}

/**
 * 根据笔记本ID获取所有富文本笔记
 * @param notebookId - 笔记本ID
 * @returns 笔记数组 Promise (Note[])
 */
export const fetchRichNotesByNotebookId = async (notebookId: string): Promise<Note[]> => {
  if (!notebookId) {
    console.warn('[richNoteService] fetchRichNotesByNotebookId called with no notebookId');
    return [];
  }
  try {
    const response = await axios.get<Note[]>(`${BACKEND_API_BASE}/api/notebooks/${notebookId}/richnotes`);
    // 统一处理 contentJson 和时间字段
    return response.data.map(normalizeNote);
  } catch (error) {
    throw handleApiError(error, 'fetchRichNotesByNotebookId');
  }
};

/**
 * 创建新的富文本笔记
 * @param notebookId - 笔记本ID
 * @param data - 包含 title, contentJson (stringified), 和 contentHtml 的对象
 * @returns 创建的笔记对象 Promise (Note)
 */
export const createRichNoteApi = async (
  notebookId: string,
  data: { title?: string | null; contentJson?: Record<string, any> | null; contentHtml?: string | null }
): Promise<Note> => {
  if (!notebookId) {
    throw new Error('Notebook ID is required to create a note.');
  }
  try {
    // contentJson 需序列化为字符串
    const payload = {
      title: data.title,
      contentJson: data.contentJson ? JSON.stringify(data.contentJson) : null,
      contentHtml: data.contentHtml,
    };
    const response = await axios.post<Note>(`${BACKEND_API_BASE}/api/notebooks/${notebookId}/richnotes`, payload);
    return normalizeNote(response.data);
  } catch (error) {
    throw handleApiError(error, 'createRichNoteApi');
  }
};

/**
 * 更新富文本笔记
 * @param notebookId - 笔记本ID (用于API路径)
 * @param noteId - 笔记ID
 * @param data - 包含要更新的 title, contentJson (stringified), 和/或 contentHtml 的对象
 * @returns 更新后的笔记对象 Promise (Note)
 */
export const updateRichNoteApi = async (
  notebookId: string,
  noteId: string,
  data: Partial<{ title?: string | null; contentJson?: Record<string, any> | null; contentHtml?: string | null }>
): Promise<Note> => {
  if (!noteId || !notebookId) {
    throw new Error('Notebook ID and Note ID are required to update a note.');
  }
  try {
    // contentJson 需序列化为字符串
    const payload = {
      ...data,
      contentJson: data.contentJson !== undefined
        ? (data.contentJson === null ? null : JSON.stringify(data.contentJson))
        : undefined,
    };
    const response = await axios.put<Note>(`${BACKEND_API_BASE}/api/notebooks/${notebookId}/richnotes/${noteId}`, payload);
    return normalizeNote(response.data);
  } catch (error) {
    throw handleApiError(error, 'updateRichNoteApi');
  }
};

/**
 * 删除富文本笔记
 * @param notebookId - 笔记本ID (用于API路径)
 * @param noteId - 笔记ID
 * @returns Promise<Note> 后端返回被删除的笔记对象
 */
export const deleteRichNoteApi = async (notebookId: string, noteId: string): Promise<Note> => {
  if (!noteId || !notebookId) {
    throw new Error('Notebook ID and Note ID are required to delete a note.');
  }
  try {
    const response = await axios.delete<Note>(`${BACKEND_API_BASE}/api/notebooks/${notebookId}/richnotes/${noteId}`);
    return normalizeNote(response.data);
  } catch (error) {
    throw handleApiError(error, 'deleteRichNoteApi');
  }
};

/**
 * 根据ID获取单个富文本笔记 (如果需要单独获取)
 * @param notebookId - 笔记本ID (用于API路径)
 * @param noteId - 笔记ID
 * @returns 笔记对象 Promise (Note)
 */
export const fetchRichNoteByIdApi = async (notebookId: string, noteId: string): Promise<Note | null> => {
  if (!noteId || !notebookId) {
    console.warn('[richNoteService] fetchRichNoteByIdApi called with no notebookId or noteId');
    return null;
  }
  try {
    const response = await axios.get<Note>(`${BACKEND_API_BASE}/api/notebooks/${notebookId}/richnotes/${noteId}`);
    return normalizeNote(response.data);
  } catch (error) {
    // 如果是404，则认为是null，否则抛出错误
    if (axios.isAxiosError(error) && error.response && error.response.status === 404) {
      return null;
    }
    throw handleApiError(error, 'fetchRichNoteByIdApi');
  }
}; 
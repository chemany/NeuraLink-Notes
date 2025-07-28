import axios from 'axios';
import { Note } from '@/types'; // 确保 Note 类型已定义

const BACKEND_API_BASE = process.env.NEXT_PUBLIC_BACKEND_API_BASE || 'http://localhost:3001';

// 帮助函数处理错误
const handleApiError = (error: any, context: string): Error => {
  console.error(`[${context}] API Error:`, error);
  if (axios.isAxiosError(error) && error.response) {
    // 如果后端返回了具体的错误信息，使用它
    const message = error.response.data?.message || error.response.statusText || error.message;
    return new Error(`API Error in ${context}: ${message} (Status: ${error.response.status})`);
  } else if (error instanceof Error) {
    // 其他 JavaScript 错误
    return new Error(`Error in ${context}: ${error.message}`);
  } else {
    // 未知错误
    return new Error(`An unknown error occurred in ${context}.`);
  }
};

/**
 * 获取指定笔记本下的所有笔记
 * @param notebookId - 笔记本ID
 * @returns 笔记数组 Promise
 */
export const fetchNotesByNotebookId = async (notebookId: string): Promise<Note[]> => {
  if (!notebookId) {
    console.warn('[noteService] fetchNotesByNotebookId: notebookId is empty. Returning empty array.');
    return [];
  }
  try {
    const response = await axios.get<Note[]>(`${BACKEND_API_BASE}/api/notebooks/${notebookId}/notes`);
    // 假设后端直接返回 Note[] 结构的数据
    // 如果后端返回的是 NotePadNote[] 或其他结构，需要在这里进行映射转换
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'fetchNotesByNotebookId');
  }
};

/**
 * 创建新笔记
 * @param notebookId - 笔记本ID
 * @param data - 包含 title 和 content 的对象
 * @returns 创建的笔记对象 Promise
 */
export const createNoteApi = async (notebookId: string, data: { title?: string; content?: string }): Promise<Note> => {
  try {
    const response = await axios.post<Note>(`${BACKEND_API_BASE}/api/notebooks/${notebookId}/notes`, data);
    // 假设后端创建成功后返回新的 Note 对象
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'createNoteApi');
  }
};

/**
 * 更新笔记
 * @param notebookId - 笔记本ID
 * @param noteId - 笔记ID
 * @param data - 包含要更新的 title 和/或 content 的对象
 * @returns 更新后的笔记对象 Promise
 */
export const updateNoteApi = async (notebookId: string, noteId: string, data: Partial<Pick<Note, 'title' | 'contentJson'>>): Promise<Note> => {
  try {
    // 注意：DTO 可能只期望 title 和 contentJson，所以我们只发送这两个字段
    const updateData = { title: data.title, contentJson: data.contentJson };
    const response = await axios.put<Note>(`${BACKEND_API_BASE}/api/notebooks/${notebookId}/notes/${noteId}`, updateData);
    // 假设后端更新成功后返回更新后的 Note 对象
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'updateNoteApi');
  }
};

/**
 * 删除笔记
 * @param notebookId - 笔记本ID
 * @param noteId - 笔记ID
 * @returns Promise<void>
 */
export const deleteNoteApi = async (notebookId: string, noteId: string): Promise<void> => {
  try {
    await axios.delete(`${BACKEND_API_BASE}/api/notebooks/${notebookId}/notes/${noteId}`);
    // 删除操作通常不返回内容
  } catch (error) {
    throw handleApiError(error, 'deleteNoteApi');
  }
}; 
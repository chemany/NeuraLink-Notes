import { Folder } from '../types';
import apiClient, { handleApiError } from './apiClient'; // 导入共享的 apiClient 和 handleApiError
import axios from 'axios'; // 导入 axios 供可能的 isAxiosError 使用，尽管 handleApiError 应该处理它

// const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001'; // 已移至 apiClient.ts

// // Helper function to get authorization headers (不再需要，apiClient 会处理)
// const getAuthHeaders = () => {
//   const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
//   const headers: HeadersInit = {
//     'Content-Type': 'application/json',
//     'Accept': 'application/json',
//   };
//   if (token) {
//     headers['Authorization'] = `Bearer ${token}`;
//   }
//   return headers;
// };

/**
 * 创建新文件夹
 * @param name 文件夹名称
 * @returns Promise<Folder> 返回创建的文件夹对象
 */
export const createFolderApi = async (name: string): Promise<Folder> => {
  console.log(`[folderService] Calling API to create folder with name: ${name}`);
  try {
    const response = await apiClient.post<Folder>('/folders', { name });
    console.log('[folderService] Successfully created folder via API:', response.data);
    return response.data;
  } catch (error) {
    console.error('[folderService] Unexpected error during folder creation API call:', error);
    throw handleApiError(error, 'createFolderApi'); // 使用共享的错误处理器
  }
};

/**
 * 获取所有文件夹
 * @returns Promise<Folder[]> 返回文件夹列表
 */
export const getFoldersApi = async (): Promise<Folder[]> => {
  console.log('[folderService] Calling API to get all folders');
  try {
    const response = await apiClient.get<Folder[]>('/folders');
    console.log('[folderService] Successfully fetched folders via API:', response.data);
    return response.data;
  } catch (error) {
    console.error('[folderService] Unexpected error during folders fetch API call:', error);
    throw handleApiError(error, 'getFoldersApi');
  }
};

/**
 * 更新文件夹名称
 * @param id 文件夹ID
 * @param name 新的文件夹名称
 * @returns Promise<Folder> 返回更新后的文件夹对象
 */
export const updateFolderApi = async (id: string, name: string): Promise<Folder> => {
  console.log(`[folderService] Calling API to update folder ${id} with name: ${name}`);
  try {
    const response = await apiClient.patch<Folder>(`/folders/${id}`, { name });
    console.log('[folderService] Successfully updated folder via API:', response.data);
    return response.data;
  } catch (error) {
    console.error('[folderService] Unexpected error during folder update API call:', error);
    throw handleApiError(error, 'updateFolderApi');
  }
};

/**
 * 删除文件夹
 * @param id 文件夹ID
 * @returns Promise<Folder> 返回被删除的文件夹对象
 */
export const deleteFolderApi = async (id: string): Promise<Folder> => {
  console.log(`[folderService] Calling API to delete folder ${id}`);
  try {
    // 根据 RESTful 惯例，DELETE 请求成功后可能返回 200 OK (带有被删除的资源) 或 204 No Content。
    // Axios 对于 204 会认为 response.data 是 undefined。后端需要确保返回被删除的文件夹对象。
    const response = await apiClient.delete<Folder>(`/folders/${id}`);
    console.log('[folderService] Successfully deleted folder via API:', response.data);
    return response.data; // 假设后端总是返回被删除的文件夹对象
  } catch (error) {
    console.error('[folderService] Unexpected error during folder deletion API call:', error);
    throw handleApiError(error, 'deleteFolderApi');
  }
}; 
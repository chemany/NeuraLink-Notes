import { Folder } from '../types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

/**
 * 创建新文件夹
 * @param name 文件夹名称
 * @returns Promise<Folder> 返回创建的文件夹对象
 */
export const createFolderApi = async (name: string): Promise<Folder> => {
  console.log(`[folderService] Calling API to create folder with name: ${name}`);
  try {
    const response = await fetch(`${API_BASE_URL}/api/folders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      console.error('[folderService] Error creating folder via API:', errorData);
      throw new Error(`API Error: ${errorData.message || response.statusText}`);
    }

    const newFolder: Folder = await response.json();
    console.log('[folderService] Successfully created folder via API:', newFolder);
    return newFolder;
  } catch (error) {
    console.error('[folderService] Unexpected error during folder creation API call:', error);
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('An unexpected error occurred during folder creation.');
    }
  }
};

/**
 * 获取所有文件夹
 * @returns Promise<Folder[]> 返回文件夹列表
 */
export const getFoldersApi = async (): Promise<Folder[]> => {
  console.log('[folderService] Calling API to get all folders');
  try {
    const response = await fetch(`${API_BASE_URL}/api/folders`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      console.error('[folderService] Error fetching folders via API:', errorData);
      throw new Error(`API Error: ${errorData.message || response.statusText}`);
    }

    const folders: Folder[] = await response.json();
    console.log('[folderService] Successfully fetched folders via API:', folders);
    return folders;
  } catch (error) {
    console.error('[folderService] Unexpected error during folders fetch API call:', error);
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('An unexpected error occurred while fetching folders.');
    }
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
    const response = await fetch(`${API_BASE_URL}/api/folders/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      console.error('[folderService] Error updating folder via API:', errorData);
      throw new Error(`API Error: ${errorData.message || response.statusText}`);
    }

    const updatedFolder: Folder = await response.json();
    console.log('[folderService] Successfully updated folder via API:', updatedFolder);
    return updatedFolder;
  } catch (error) {
    console.error('[folderService] Unexpected error during folder update API call:', error);
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('An unexpected error occurred while updating folder.');
    }
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
    const response = await fetch(`${API_BASE_URL}/api/folders/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      console.error('[folderService] Error deleting folder via API:', errorData);
      throw new Error(`API Error: ${errorData.message || response.statusText}`);
    }

    const deletedFolder: Folder = await response.json();
    console.log('[folderService] Successfully deleted folder via API:', deletedFolder);
    return deletedFolder;
  } catch (error) {
    console.error('[folderService] Unexpected error during folder deletion API call:', error);
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('An unexpected error occurred while deleting folder.');
    }
  }
}; 
/**
 * 白板服务 - 用于处理白板相关操作
 */

import apiClient from './apiClient';

interface WhiteboardItem {
  id: string;
  content: string;
  position: {
    x: number;
    y: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface WhiteboardCreateDto {
  content: string;
  position?: {
    x: number;
    y: number;
  };
}

/**
 * 获取白板列表
 * @returns 白板项目列表
 */
export const getWhiteboardItems = async (): Promise<WhiteboardItem[]> => {
  try {
    const response = await apiClient.get('/whiteboard');
    return response.data;
  } catch (error) {
    console.error('获取白板列表失败:', error);
    throw error;
  }
};

/**
 * 添加内容到白板
 * @param content 要添加的内容
 * @param position 位置信息（可选）
 * @returns 创建的白板项
 */
export const addToWhiteboard = async (
  content: string,
  position?: { x: number; y: number }
): Promise<WhiteboardItem> => {
  try {
    // 如果没有提供位置，则随机生成一个合理的位置
    const defaultPosition = position || {
      x: Math.floor(Math.random() * 500),
      y: Math.floor(Math.random() * 300)
    };

    const createDto: WhiteboardCreateDto = {
      content,
      position: defaultPosition
    };

    const response = await apiClient.post('/whiteboard', createDto);
    return response.data;
  } catch (error) {
    console.error('添加到白板失败:', error);
    throw error;
  }
};

/**
 * 更新白板项目
 * @param id 项目ID
 * @param updates 要更新的字段
 * @returns 更新后的白板项
 */
export const updateWhiteboardItem = async (
  id: string,
  updates: Partial<WhiteboardItem>
): Promise<WhiteboardItem> => {
  try {
    const response = await apiClient.put(`/whiteboard/${id}`, updates);
    return response.data;
  } catch (error) {
    console.error('更新白板项目失败:', error);
    throw error;
  }
};

/**
 * 删除白板项目
 * @param id 要删除的项目ID
 */
export const deleteWhiteboardItem = async (id: string): Promise<void> => {
  try {
    await apiClient.delete(`/whiteboard/${id}`);
  } catch (error) {
    console.error('删除白板项目失败:', error);
    throw error;
  }
}; 
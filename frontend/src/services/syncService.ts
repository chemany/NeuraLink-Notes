import axios from 'axios';
import { API_URL } from '../utils/constants';

export interface SyncConfig {
  id?: string;
  name: string;
  type: 'WEBDAV' | 'S3';
  webdavUrl?: string;
  webdavUsername?: string;
  webdavPassword?: string;
  webdavPath?: string;
  s3Region?: string;
  s3Bucket?: string;
  s3AccessKey?: string;
  s3SecretKey?: string;
  s3Endpoint?: string;
  s3Path?: string;
  s3Acl?: string;
  isActive?: boolean;
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

class SyncService {
  // 获取所有同步配置
  async getAllConfigs(): Promise<SyncConfig[]> {
    try {
      const response = await axios.get(`${API_URL}/sync/configs`);
      return response.data;
    } catch (error) {
      console.error('获取同步配置失败', error);
      throw error;
    }
  }

  // 获取单个同步配置
  async getConfig(id: string): Promise<SyncConfig> {
    try {
      const response = await axios.get(`${API_URL}/sync/configs/${id}`);
      return response.data;
    } catch (error) {
      console.error(`获取同步配置 ${id} 失败`, error);
      throw error;
    }
  }

  // 创建同步配置
  async createConfig(config: SyncConfig): Promise<SyncConfig> {
    try {
      const response = await axios.post(`${API_URL}/sync/configs`, config);
      return response.data;
    } catch (error) {
      console.error('创建同步配置失败', error);
      throw error;
    }
  }

  // 更新同步配置
  async updateConfig(id: string, config: SyncConfig): Promise<SyncConfig> {
    try {
      const response = await axios.put(`${API_URL}/sync/configs/${id}`, config);
      return response.data;
    } catch (error) {
      console.error(`更新同步配置 ${id} 失败`, error);
      throw error;
    }
  }

  // 删除同步配置
  async deleteConfig(id: string): Promise<{ success: boolean }> {
    try {
      const response = await axios.delete(`${API_URL}/sync/configs/${id}`);
      return response.data;
    } catch (error) {
      console.error(`删除同步配置 ${id} 失败`, error);
      throw error;
    }
  }

  // 测试同步配置连接
  async testConnection(id: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await axios.post(`${API_URL}/sync/configs/${id}/test`);
      return response.data;
    } catch (error) {
      console.error(`测试同步配置 ${id} 失败`, error);
      throw error;
    }
  }

  // 同步数据到云端
  async syncToCloud(id: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await axios.post(`${API_URL}/sync/to-cloud/${id}`);
      return response.data;
    } catch (error) {
      console.error(`同步到云端失败 ${id}`, error);
      throw error;
    }
  }

  // 从云端同步数据
  async syncFromCloud(id: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await axios.post(`${API_URL}/sync/from-cloud/${id}`);
      return response.data;
    } catch (error) {
      console.error(`从云端同步失败 ${id}`, error);
      throw error;
    }
  }
}

export default new SyncService(); 
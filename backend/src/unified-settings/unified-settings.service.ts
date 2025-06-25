import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 统一设置服务
 * 直接操作用户设置文件夹中的JSON文件
 */
@Injectable()
export class UnifiedSettingsService {
  private readonly settingsBasePath = 'C:\\code\\unified-settings-service\\user-settings';
  private readonly defaultModelsPath = 'C:\\code\\unified-settings-service\\config\\default-models.json';

  /**
   * 获取用户设置目录
   */
  private getUserSettingsPath(userId: string): string {
    return path.join(this.settingsBasePath, userId);
  }

  /**
   * 确保用户设置目录存在
   */
  private ensureUserDirectory(userId: string): void {
    const userPath = this.getUserSettingsPath(userId);
    if (!fs.existsSync(userPath)) {
      fs.mkdirSync(userPath, { recursive: true });
    }
  }

  /**
   * 读取JSON文件
   */
  private readJsonFile(filePath: string, defaultValue: any = null): any {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
      }
      return defaultValue;
    } catch (error) {
      console.error(`读取JSON文件失败: ${filePath}`, error);
      return defaultValue;
    }
  }

  /**
   * 写入JSON文件
   */
  private writeJsonFile(filePath: string, data: any): boolean {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      const content = JSON.stringify(data, null, 2);
      fs.writeFileSync(filePath, content, 'utf-8');
      return true;
    } catch (error) {
      console.error(`写入JSON文件失败: ${filePath}`, error);
      return false;
    }
  }

  /**
   * 获取默认模型配置 - 过滤敏感信息
   */
  getDefaultModels(): any {
    const config = this.readJsonFile(this.defaultModelsPath, {});
    
    // 为了安全，移除内置模型的真实API密钥，使用占位符
    if (config.builtin_free) {
      const sanitizedConfig = {
        ...config,
        builtin_free: {
          ...config.builtin_free,
          api_key: 'BUILTIN_PROXY', // 使用占位符替代真实API密钥
          base_url: 'BUILTIN_PROXY' // 使用占位符替代真实端点
        }
      };
      console.log('[UnifiedSettingsService] 返回安全的默认模型配置');
      return sanitizedConfig;
    }
    
    return config;
  }

  /**
   * 获取LLM设置 - 只返回providers配置，不包含current_provider
   */
  getLLMSettings(userId: string): any {
    this.ensureUserDirectory(userId);
    const llmPath = path.join(this.getUserSettingsPath(userId), 'llm.json');
    
    const defaultSettings = {
      providers: {
        builtin: {
          api_key: 'builtin-free-key',
          model_name: 'builtin-free',
          base_url: '',
          description: '内置免费模型',
          updated_at: new Date().toISOString()
        }
      },
      updated_at: new Date().toISOString()
    };
    
    return this.readJsonFile(llmPath, defaultSettings);
  }

  /**
   * 保存LLM设置 - 只保存provider配置，不保存current_provider
   */
  saveLLMSettings(userId: string, provider: string, settings: any): boolean {
    this.ensureUserDirectory(userId);
    const llmPath = path.join(this.getUserSettingsPath(userId), 'llm.json');
    
    // 读取现有配置
    const currentConfig = this.getLLMSettings(userId);
    
    // 更新配置 - 移除current_provider，只更新providers
    const updatedConfig = {
      providers: {
        ...currentConfig.providers,
        [provider]: {
          ...settings,
          updated_at: new Date().toISOString()
        }
      },
      updated_at: new Date().toISOString()
    };
    
    return this.writeJsonFile(llmPath, updatedConfig);
  }

  /**
   * 获取Embedding设置
   */
  getEmbeddingSettings(userId: string): any {
    this.ensureUserDirectory(userId);
    const embeddingPath = path.join(this.getUserSettingsPath(userId), 'embedding.json');
    
    const defaultSettings = {
      provider: 'openai',
      model: 'BAAI/bge-m3',
      updated_at: new Date().toISOString()
    };
    
    return this.readJsonFile(embeddingPath, defaultSettings);
  }

  /**
   * 保存Embedding设置
   */
  saveEmbeddingSettings(userId: string, settings: any): boolean {
    this.ensureUserDirectory(userId);
    const embeddingPath = path.join(this.getUserSettingsPath(userId), 'embedding.json');
    
    const settingsWithTimestamp = {
      ...settings,
      updated_at: new Date().toISOString()
    };
    
    return this.writeJsonFile(embeddingPath, settingsWithTimestamp);
  }

  /**
   * 获取Reranking设置
   */
  getRerankingSettings(userId: string): any {
    this.ensureUserDirectory(userId);
    const rerankingPath = path.join(this.getUserSettingsPath(userId), 'reranking.json');
    
    const defaultSettings = {
      enableReranking: false,
      rerankingProvider: 'siliconflow',
      rerankingModel: 'BAAI/bge-reranker-v2-m3',
      rerankingCustomEndpoint: '',
      updated_at: new Date().toISOString()
    };
    
    return this.readJsonFile(rerankingPath, defaultSettings);
  }

  /**
   * 保存Reranking设置
   */
  saveRerankingSettings(userId: string, settings: any): boolean {
    this.ensureUserDirectory(userId);
    const rerankingPath = path.join(this.getUserSettingsPath(userId), 'reranking.json');
    
    const settingsWithTimestamp = {
      ...settings,
      updated_at: new Date().toISOString()
    };
    
    return this.writeJsonFile(rerankingPath, settingsWithTimestamp);
  }
}
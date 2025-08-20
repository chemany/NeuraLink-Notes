import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 统一设置服务
 * 使用新的统一用户数据管理系统
 */
@Injectable()
export class UnifiedSettingsService {
  private readonly userDataPath: string;
  private readonly usersCSVPath: string;
  private readonly defaultModelsPath: string;

  constructor() {
    // 使用环境变量确定存储路径
    const storageType = process.env.STORAGE_TYPE || 'local';
    const nasPath = process.env.NAS_PATH || '/mnt/nas-sata12';

    if (storageType === 'nas') {
      this.userDataPath = path.join(nasPath, 'MindOcean', 'user-data', 'settings');
      this.defaultModelsPath = path.join(nasPath, 'MindOcean', 'user-data', 'settings', 'default-models.json');
    } else {
      this.userDataPath = 'C:\\code\\unified-settings-service\\user-data-v2';
      this.defaultModelsPath = 'C:\\code\\unified-settings-service\\config\\default-models.json';
    }

    this.usersCSVPath = path.join(this.userDataPath, 'users.csv');

    console.log(`[UnifiedSettingsService] 使用存储路径: ${this.userDataPath}`);
  }

  /**
   * 根据用户ID获取用户名
   * 如果输入的已经是用户名，则直接返回
   */
  private getUsernameFromId(userId: string): string {
    try {
      if (!fs.existsSync(this.usersCSVPath)) {
        console.log(`[UnifiedSettingsService] CSV文件不存在，使用用户ID: ${this.usersCSVPath}`);
        return userId;
      }

      const csvData = fs.readFileSync(this.usersCSVPath, 'utf8');
      const lines = csvData.trim().split('\n');

      if (lines.length <= 1) {
        console.log(`[UnifiedSettingsService] CSV文件为空，使用用户ID`);
        return userId;
      }

      // 跳过表头，查找用户
      for (let i = 1; i < lines.length; i++) {
        const columns = lines[i].split(',');
        if (columns.length >= 2) {
          const csvUserId = columns[0];
          const csvUsername = columns[1];

          // 如果输入的是用户ID，返回对应的用户名
          if (csvUserId === userId) {
            console.log(`[UnifiedSettingsService] 通过用户ID找到用户名: ${userId} -> ${csvUsername}`);
            return csvUsername;
          }

          // 如果输入的已经是用户名，直接返回
          if (csvUsername === userId) {
            console.log(`[UnifiedSettingsService] 输入已经是用户名: ${userId}`);
            return userId;
          }
        }
      }

      console.log(`[UnifiedSettingsService] 未找到用户ID/用户名 ${userId}，使用原值`);
      return userId;
    } catch (error) {
      console.error(`[UnifiedSettingsService] 获取用户名失败，使用用户ID:`, error);
      return userId;
    }
  }

  /**
   * 获取用户设置文件路径
   */
  private getUserSettingsFilePath(userId: string): string {
    const username = this.getUsernameFromId(userId);
    return path.join(this.userDataPath, `${username}_settings.json`);
  }

  /**
   * 确保用户数据目录存在
   */
  private ensureUserDataDirectory(): void {
    if (!fs.existsSync(this.userDataPath)) {
      fs.mkdirSync(this.userDataPath, { recursive: true });
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
   * Provider 映射关系：用户配置 -> 默认模型配置
   */
  private getProviderMapping(): Record<string, string> {
    return {
      'builtin-neuralink': 'builtin_free_neuralink',
      'builtin-tidelog': 'builtin_free_tidelog', 
      'builtin-general': 'builtin_free_general',
      'builtin': 'builtin_free_general'  // 向后兼容
    };
  }

  /**
   * 根据用户配置的 provider 获取对应的默认模型配置
   */
  private resolveBuiltinConfig(userProvider: string): any {
    const mapping = this.getProviderMapping();
    const configKey = mapping[userProvider];
    
    if (!configKey) {
      console.warn(`[UnifiedSettingsService] 未知的 provider: ${userProvider}`);
      return null;
    }
    
    const defaultModels = this.readJsonFile(this.defaultModelsPath, {});
    return defaultModels[configKey] || null;
  }

  /**
   * 获取默认模型配置 - 过滤敏感信息
   */
  getDefaultModels(): any {
    const config = this.readJsonFile(this.defaultModelsPath, {});
    
    // 为了安全，移除内置模型的真实API密钥，使用占位符
    const sanitizedConfig = { ...config };
    
    // 处理所有内置模型配置
    ['builtin_free_neuralink', 'builtin_free_tidelog', 'builtin_free_general', 'builtin_free'].forEach(key => {
      if (config[key]) {
        sanitizedConfig[key] = {
          ...config[key],
          api_key: 'BUILTIN_PROXY', // 使用占位符替代真实API密钥
          base_url: 'BUILTIN_PROXY' // 使用占位符替代真实端点
        };
      }
    });
    
    console.log('[UnifiedSettingsService] 返回安全的默认模型配置');
    return sanitizedConfig;
  }

  /**
   * 获取LLM设置 - 从统一设置文件中获取（专门为灵枢笔记）
   */
  getLLMSettings(userId: string): any {
    this.ensureUserDataDirectory();
    const settingsPath = this.getUserSettingsFilePath(userId);

    const defaultLLMSettings = {
      provider: 'builtin-free',
      model: 'deepseek/deepseek-chat-v3-0324:free',
      updated_at: new Date().toISOString()
    };

    const defaultSettings = {
      user_info: {
        user_id: userId,
        username: this.getUsernameFromId(userId),
        email: `${this.getUsernameFromId(userId)}@example.com`
      },
      llm: defaultLLMSettings,
      vectorization: {
        provider: 'builtin-free',
        model: 'text-embedding-3-small',
        updated_at: new Date().toISOString()
      },
      reranking: {
        provider: 'builtin-free',
        model: 'jina-reranker-v1-base-en',
        updated_at: new Date().toISOString()
      },
      updated_at: new Date().toISOString()
    };

    const settings = this.readJsonFile(settingsPath, defaultSettings);

    console.log(`[UnifiedSettingsService] 获取LLM设置 - userId: ${userId}`);
    console.log(`[UnifiedSettingsService] 设置文件路径: ${settingsPath}`);
    
    // 优先使用 neuralink_llm 字段（灵枢笔记专用配置）
    if (settings.neuralink_llm) {
      console.log(`[UnifiedSettingsService] 找到灵枢笔记专用LLM配置:`, settings.neuralink_llm);
      
      // 如果是自定义配置，直接返回（不使用providers格式）
      if (settings.neuralink_llm.provider === 'custom' && 
          settings.neuralink_llm.api_key && 
          settings.neuralink_llm.custom_endpoint) {
        return {
          provider: settings.neuralink_llm.provider,
          model_name: settings.neuralink_llm.model,
          api_key: settings.neuralink_llm.api_key,
          custom_endpoint: settings.neuralink_llm.custom_endpoint,
          updated_at: settings.neuralink_llm.updated_at
        };
      }
      
      // 如果是内置配置，使用映射逻辑
      if (settings.neuralink_llm.provider && settings.neuralink_llm.provider.startsWith('builtin')) {
        const builtinConfig = this.resolveBuiltinConfig(settings.neuralink_llm.provider);
        if (builtinConfig) {
          console.log(`[UnifiedSettingsService] 映射到内置配置: ${settings.neuralink_llm.provider} -> ${builtinConfig.name}`);
          return {
            provider: settings.neuralink_llm.provider,
            model_name: builtinConfig.model_name,
            api_key: builtinConfig.api_key,
            base_url: builtinConfig.base_url,
            temperature: builtinConfig.temperature,
            max_tokens: builtinConfig.max_tokens,
            updated_at: settings.neuralink_llm.updated_at
          };
        }
      }
    }

    // 回退到传统的providers配置格式
    return {
      providers: {
        builtin: {
          api_key: 'builtin-free-key',
          model_name: (settings.neuralink_llm?.model || settings.llm?.model || defaultLLMSettings.model),
          base_url: '',
          description: '内置免费模型',
          updated_at: (settings.neuralink_llm?.updated_at || settings.llm?.updated_at || defaultLLMSettings.updated_at)
        }
      },
      updated_at: settings.updated_at
    };
  }

  /**
   * 保存LLM设置 - 保存到统一设置文件
   */
  saveLLMSettings(userId: string, provider: string, settings: any): boolean {
    this.ensureUserDataDirectory();
    const settingsPath = this.getUserSettingsFilePath(userId);

    // 读取现有的完整设置
    const currentSettings = this.readJsonFile(settingsPath, {
      user_info: {
        user_id: userId,
        username: this.getUsernameFromId(userId),
        email: `${this.getUsernameFromId(userId)}@example.com`
      },
      llm: {
        provider: 'builtin-free',
        model: 'deepseek/deepseek-chat-v3-0324:free',
        updated_at: new Date().toISOString()
      },
      vectorization: {
        provider: 'builtin-free',
        model: 'text-embedding-3-small',
        updated_at: new Date().toISOString()
      },
      reranking: {
        provider: 'builtin-free',
        model: 'jina-reranker-v1-base-en',
        updated_at: new Date().toISOString()
      },
      updated_at: new Date().toISOString()
    });

    // 更新LLM设置
    let modelName = 'USE_DEFAULT_CONFIG';

    // 根据前端数据结构确定模型名称
    if (settings.use_custom_model && settings.custom_model) {
      modelName = settings.custom_model;
    } else if (settings.predefined_model) {
      modelName = settings.predefined_model;
    } else if (settings.model_name) {
      modelName = settings.model_name;
    } else if (settings.model) {
      modelName = settings.model;
    }

    const llmSettings: any = {
      provider: provider,
      model: modelName,
      updated_at: new Date().toISOString()
    };

    // 保存API密钥和基础URL
    if (settings.api_key && typeof settings.api_key === 'string' && settings.api_key.trim() !== '') {
      llmSettings.api_key = settings.api_key.trim();
    }

    if (settings.base_url && typeof settings.base_url === 'string' && settings.base_url.trim() !== '') {
      llmSettings.base_url = settings.base_url.trim();
    }

    const updatedSettings = {
      ...currentSettings,
      llm: llmSettings,
      updated_at: new Date().toISOString()
    };

    console.log(`[UnifiedSettingsService] 保存LLM设置: ${userId} -> ${provider}`);
    return this.writeJsonFile(settingsPath, updatedSettings);
  }

  /**
   * 获取Embedding（向量化）设置
   */
  getEmbeddingSettings(userId: string): any {
    this.ensureUserDataDirectory();
    const settingsPath = this.getUserSettingsFilePath(userId);

    const defaultSettings = {
      user_info: {
        user_id: userId,
        username: this.getUsernameFromId(userId),
        email: `${this.getUsernameFromId(userId)}@example.com`
      },
      vectorization: {
        provider: 'builtin-free',
        model: 'text-embedding-3-small',
        updated_at: new Date().toISOString()
      }
    };

    const settings = this.readJsonFile(settingsPath, defaultSettings);

    // 返回向量化设置，保持向后兼容的格式
    const vectorizationSettings: any = {
      provider: settings.vectorization?.provider || 'builtin-free',
      model: settings.vectorization?.model || 'text-embedding-3-small',
      updated_at: settings.vectorization?.updated_at || new Date().toISOString()
    };

    // 添加API相关字段（返回前端期望的字段名）
    if (settings.vectorization?.api_key) {
      vectorizationSettings.apiKey = settings.vectorization.api_key;
    }
    if (settings.vectorization?.base_url) {
      vectorizationSettings.baseUrl = settings.vectorization.base_url;
    }
    if (settings.vectorization?.custom_endpoint) {
      vectorizationSettings.customEndpoint = settings.vectorization.custom_endpoint;
    }

    return vectorizationSettings;
  }

  /**
   * 保存Embedding（向量化）设置
   */
  saveEmbeddingSettings(userId: string, settings: any): boolean {
    this.ensureUserDataDirectory();
    const settingsPath = this.getUserSettingsFilePath(userId);

    // 读取现有的完整设置
    const currentSettings = this.readJsonFile(settingsPath, {
      user_info: {
        user_id: userId,
        username: this.getUsernameFromId(userId),
        email: `${this.getUsernameFromId(userId)}@example.com`
      },
      llm: {
        provider: 'builtin-free',
        model: 'deepseek/deepseek-chat-v3-0324:free',
        updated_at: new Date().toISOString()
      },
      vectorization: {
        provider: 'builtin-free',
        model: 'text-embedding-3-small',
        updated_at: new Date().toISOString()
      },
      reranking: {
        provider: 'builtin-free',
        model: 'jina-reranker-v1-base-en',
        updated_at: new Date().toISOString()
      },
      updated_at: new Date().toISOString()
    });

    // 更新向量化设置
    const vectorizationSettings: any = {
      provider: settings.provider || 'builtin-free',
      model: settings.model || 'text-embedding-3-small',
      updated_at: new Date().toISOString()
    };

    // 安全地处理API相关字段
    try {
      // 处理API密钥 - 使用更严格的过滤条件
      const apiKey = settings.api_key || settings.apiKey;
      if (apiKey && typeof apiKey === 'string') {
        const cleanApiKey = apiKey.trim();
        // 只保存看起来像正常API密钥的值（不包含日志信息）
        if (cleanApiKey.length > 0 &&
            cleanApiKey.length < 200 &&
            !cleanApiKey.includes('[') &&
            !cleanApiKey.includes(']') &&
            !cleanApiKey.includes('UnifiedAuth') &&
            !cleanApiKey.includes('UnifiedSettings') &&
            !cleanApiKey.includes('LOG') &&
            !cleanApiKey.includes('认证成功')) {
          vectorizationSettings.api_key = cleanApiKey;
        }
      }

      // 处理基础URL
      const baseUrl = settings.base_url || settings.baseUrl;
      if (baseUrl && typeof baseUrl === 'string') {
        const cleanBaseUrl = baseUrl.trim();
        if (cleanBaseUrl.length > 0 && cleanBaseUrl.length < 500) {
          vectorizationSettings.base_url = cleanBaseUrl;
        }
      }

      // 处理自定义端点
      const customEndpoint = settings.custom_endpoint || settings.customEndpoint;
      if (customEndpoint && typeof customEndpoint === 'string') {
        const cleanEndpoint = customEndpoint.trim();
        if (cleanEndpoint.length > 0 && cleanEndpoint.length < 500) {
          vectorizationSettings.custom_endpoint = cleanEndpoint;
        }
      }
    } catch (fieldError) {
      console.error(`[UnifiedSettingsService] 处理API字段时出错:`, fieldError);
    }

    const updatedSettings = {
      ...currentSettings,
      vectorization: vectorizationSettings,
      updated_at: new Date().toISOString()
    };

    console.log(`[UnifiedSettingsService] 保存向量化设置: ${userId} -> ${settings.provider}/${settings.model}`);

    // 创建安全的日志输出（隐藏敏感信息）
    const safeLogSettings = { ...vectorizationSettings };
    if (safeLogSettings.api_key) {
      safeLogSettings.api_key = '***HIDDEN***';
    }
    console.log(`[UnifiedSettingsService] 完整向量化设置:`, JSON.stringify(safeLogSettings, null, 2));
    return this.writeJsonFile(settingsPath, updatedSettings);
  }

  /**
   * 获取Reranking（重排序）设置
   */
  getRerankingSettings(userId: string): any {
    this.ensureUserDataDirectory();
    const settingsPath = this.getUserSettingsFilePath(userId);

    const defaultSettings = {
      user_info: {
        user_id: userId,
        username: this.getUsernameFromId(userId),
        email: `${this.getUsernameFromId(userId)}@example.com`
      },
      reranking: {
        provider: 'builtin-free',
        model: 'jina-reranker-v1-base-en',
        updated_at: new Date().toISOString()
      }
    };

    const settings = this.readJsonFile(settingsPath, defaultSettings);

    // 返回重排序设置，保持向后兼容的格式
    return {
      enableReranking: true,
      rerankingProvider: settings.reranking?.provider || 'builtin-free',
      rerankingModel: settings.reranking?.model || 'jina-reranker-v1-base-en',
      rerankingCustomEndpoint: '',
      updated_at: settings.reranking?.updated_at || new Date().toISOString()
    };
  }

  /**
   * 保存Reranking（重排序）设置
   */
  saveRerankingSettings(userId: string, settings: any): boolean {
    this.ensureUserDataDirectory();
    const settingsPath = this.getUserSettingsFilePath(userId);

    // 读取现有的完整设置
    const currentSettings = this.readJsonFile(settingsPath, {
      user_info: {
        user_id: userId,
        username: this.getUsernameFromId(userId),
        email: `${this.getUsernameFromId(userId)}@example.com`
      },
      llm: {
        provider: 'builtin-free',
        model: 'deepseek/deepseek-chat-v3-0324:free',
        updated_at: new Date().toISOString()
      },
      vectorization: {
        provider: 'builtin-free',
        model: 'text-embedding-3-small',
        updated_at: new Date().toISOString()
      },
      reranking: {
        provider: 'builtin-free',
        model: 'jina-reranker-v1-base-en',
        updated_at: new Date().toISOString()
      },
      updated_at: new Date().toISOString()
    });

    // 更新重排序设置
    const updatedSettings = {
      ...currentSettings,
      reranking: {
        provider: settings.rerankingProvider || 'builtin-free',
        model: settings.rerankingModel || 'jina-reranker-v1-base-en',
        updated_at: new Date().toISOString()
      },
      updated_at: new Date().toISOString()
    };

    console.log(`[UnifiedSettingsService] 保存重排序设置: ${userId} -> ${settings.rerankingProvider}/${settings.rerankingModel}`);
    return this.writeJsonFile(settingsPath, updatedSettings);
  }
}
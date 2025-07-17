import { Controller, Get, Post, Body, Request, UseGuards } from '@nestjs/common';
import { UnifiedSettingsService } from './unified-settings.service';
import { LocalSettingsService } from './local-settings.service';
import { UnifiedAuthGuard, AuthenticatedRequest } from '../unified-auth/unified-auth.guard';

/**
 * 统一设置控制器
 * 提供灵枢笔记的设置管理API
 * 使用真实用户认证，确保数据隔离
 */
@Controller('unified-settings')
@UseGuards(UnifiedAuthGuard)
export class UnifiedSettingsController {
  constructor(
    private readonly unifiedSettingsService: UnifiedSettingsService,
    private readonly localSettingsService: LocalSettingsService
  ) {}

  /**
   * 获取默认模型配置
   */
  @Get('default-models')
  getDefaultModels() {
    try {
      const models = this.unifiedSettingsService.getDefaultModels();
      return {
        success: true,
        data: models
      };
    } catch (error) {
      return {
        success: false,
        error: '获取默认模型配置失败'
      };
    }
  }

  /**
   * 获取LLM设置（合并共享配置和本地选择）
   */
  @Get('llm')
  async getLLMSettings(@Request() req: AuthenticatedRequest) {
    try {
      // 根据用户邮箱映射到统一设置服务的用户ID
      const userEmail = req.user.email;
      const userId = this.getUserIdFromEmail(userEmail);
      console.log('[UnifiedSettingsController] 获取LLM设置，邮箱:', userEmail, '映射用户ID:', userId);

      // 直接从统一设置服务的JSON文件中读取设置
      const settingsService = require('../settings/settings.service').SettingsService;
      const settingsServiceInstance = new settingsService(null); // PrismaService不需要用于读取JSON文件
      const fullSettings = await settingsServiceInstance.getFullUserSettingsFromUnified(userId);

      console.log('[UnifiedSettingsController] 从统一设置服务获取的完整设置:', fullSettings);

      // 返回LLM设置部分，格式与前端期望的一致
      const llmConfig = {
        current_provider: fullSettings.llmSettings.provider,
        providers: {
          [fullSettings.llmSettings.provider]: {
            api_key: fullSettings.llmSettings.apiKey,
            model_name: fullSettings.llmSettings.model,
            base_url: fullSettings.llmSettings.customEndpoint,
            use_custom_model: fullSettings.llmSettings.useCustomModel,
            updated_at: new Date().toISOString()
          }
        },
        updated_at: new Date().toISOString()
      };

      console.log('[UnifiedSettingsController] 转换后的LLM配置:', llmConfig);

      return {
        success: true,
        data: llmConfig
      };
    } catch (error) {
      console.error('获取LLM设置失败:', error);
      return {
        success: false,
        error: '获取LLM设置失败'
      };
    }
  }

  /**
   * 保存LLM设置（分别保存共享配置和本地选择）
   */
  @Post('llm')
  saveLLMSettings(@Request() req: AuthenticatedRequest, @Body() body: { provider: string; settings: any }) {
    try {
      // 根据用户邮箱映射到统一设置服务的用户ID
      const userEmail = req.user.email;
      const userId = this.getUserIdFromEmail(userEmail);
      const { provider, settings } = body;
      console.log('[UnifiedSettingsController] 保存LLM设置，邮箱:', userEmail, '映射用户ID:', userId, 'provider:', provider);
      console.log('[UnifiedSettingsController] LLM设置详细数据:', JSON.stringify(settings, null, 2));

      // 保存provider配置到共享文件
      const sharedSuccess = this.unifiedSettingsService.saveLLMSettings(userId, provider, settings);

      // 保存当前选择的provider到本地文件
      const localSuccess = this.localSettingsService.setCurrentLLMProvider(provider);

      if (sharedSuccess && localSuccess) {
        return {
          success: true,
          message: 'LLM设置保存成功'
        };
      } else {
        return {
          success: false,
          error: 'LLM设置保存失败'
        };
      }
    } catch (error) {
      console.error('保存LLM设置失败:', error);
      return {
        success: false,
        error: '保存LLM设置失败'
      };
    }
  }

  /**
   * 获取Embedding设置
   */
  @Get('embedding')
  async getEmbeddingSettings(@Request() req: AuthenticatedRequest) {
    try {
      // 根据用户邮箱映射到统一设置服务的用户ID
      const userEmail = req.user.email;
      const userId = this.getUserIdFromEmail(userEmail);
      console.log('[UnifiedSettingsController] 获取Embedding设置，邮箱:', userEmail, '映射用户ID:', userId);

      // 直接从统一设置服务的JSON文件中读取设置
      const settingsService = require('../settings/settings.service').SettingsService;
      const settingsServiceInstance = new settingsService(null);
      const fullSettings = await settingsServiceInstance.getFullUserSettingsFromUnified(userId);

      console.log('[UnifiedSettingsController] 从统一设置服务获取的向量化设置:', fullSettings.embeddingSettings);

      return {
        success: true,
        data: fullSettings.embeddingSettings
      };
    } catch (error) {
      console.error('获取Embedding设置失败:', error);
      return {
        success: false,
        error: '获取Embedding设置失败'
      };
    }
  }

  /**
   * 保存Embedding设置
   */
  @Post('embedding')
  saveEmbeddingSettings(@Request() req: AuthenticatedRequest, @Body() settings: any) {
    try {
      // 根据用户邮箱映射到统一设置服务的用户ID
      const userEmail = req.user.email;
      const userId = this.getUserIdFromEmail(userEmail);
      console.log('[UnifiedSettingsController] 保存Embedding设置，邮箱:', userEmail, '映射用户ID:', userId);
      // 安全地记录接收到的数据（隐藏敏感信息）
      const safeSettings = { ...settings };
      if (safeSettings.api_key) {
        safeSettings.api_key = '***HIDDEN***';
      }
      console.log('[UnifiedSettingsController] 接收到的Embedding数据:', JSON.stringify(safeSettings, null, 2));

      const success = this.unifiedSettingsService.saveEmbeddingSettings(userId, settings);

      if (success) {
        return {
          success: true,
          message: 'Embedding设置保存成功'
        };
      } else {
        return {
          success: false,
          error: 'Embedding设置保存失败'
        };
      }
    } catch (error) {
      console.error('保存Embedding设置失败:', error);
      return {
        success: false,
        error: '保存Embedding设置失败'
      };
    }
  }

  /**
   * 获取Reranking设置
   */
  @Get('reranking')
  async getRerankingSettings(@Request() req: AuthenticatedRequest) {
    try {
      // 根据用户邮箱映射到统一设置服务的用户ID
      const userEmail = req.user.email;
      const userId = this.getUserIdFromEmail(userEmail);
      console.log('[UnifiedSettingsController] 获取Reranking设置，邮箱:', userEmail, '映射用户ID:', userId);

      // 直接从统一设置服务的JSON文件中读取设置
      const settingsService = require('../settings/settings.service').SettingsService;
      const settingsServiceInstance = new settingsService(null);
      const fullSettings = await settingsServiceInstance.getFullUserSettingsFromUnified(userId);

      console.log('[UnifiedSettingsController] 从统一设置服务获取的重排序设置:', fullSettings.rerankingSettings);

      return {
        success: true,
        data: fullSettings.rerankingSettings
      };
    } catch (error) {
      console.error('获取Reranking设置失败:', error);
      return {
        success: false,
        error: '获取Reranking设置失败'
      };
    }
  }

  /**
   * 保存Reranking设置
   */
  @Post('reranking')
  saveRerankingSettings(@Request() req: AuthenticatedRequest, @Body() settings: any) {
    try {
      // 根据用户邮箱映射到统一设置服务的用户ID
      const userEmail = req.user.email;
      const userId = this.getUserIdFromEmail(userEmail);
      console.log('[UnifiedSettingsController] 保存Reranking设置，邮箱:', userEmail, '映射用户ID:', userId);

      const success = this.unifiedSettingsService.saveRerankingSettings(userId, settings);

      if (success) {
        return {
          success: true,
          message: 'Reranking设置保存成功'
        };
      } else {
        return {
          success: false,
          error: 'Reranking设置保存失败'
        };
      }
    } catch (error) {
      console.error('保存Reranking设置失败:', error);
      return {
        success: false,
        error: '保存Reranking设置失败'
      };
    }
  }

  /**
   * 根据用户邮箱映射到统一设置服务的用户ID
   * 这确保同一用户在不同应用中使用相同的设置文件
   */
  private getUserIdFromEmail(email: string): string {
    // 邮箱到用户名的映射
    const emailToUsername: Record<string, string> = {
      'link918@qq.com': 'jason'
      // 可以在这里添加更多映射
    };

    // 如果有映射，返回用户名，否则使用邮箱前缀
    const username = emailToUsername[email] || email.split('@')[0];

    console.log('[UnifiedSettingsController] 邮箱映射:', email, '->', username);
    return username;
  }
}
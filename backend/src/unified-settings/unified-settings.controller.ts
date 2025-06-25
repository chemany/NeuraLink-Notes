import { Controller, Get, Post, Body, Request } from '@nestjs/common';
import { UnifiedSettingsService } from './unified-settings.service';
import { LocalSettingsService } from './local-settings.service';

/**
 * 统一设置控制器
 * 提供灵枢笔记的设置管理API
 * 临时移除认证守卫，使用固定用户ID
 */
@Controller('unified-settings')
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
  getLLMSettings() {
    try {
      // 使用固定的用户ID（与智能日历保持一致）
      const userId = 'cmmc03v95m7xzqxwewhjt';
      
      // 获取共享的providers配置
      const sharedConfig = this.unifiedSettingsService.getLLMSettings(userId);
      
      // 合并本地的current_provider选择
      const completeConfig = this.localSettingsService.getCompleteLLMConfig(sharedConfig);
      
      return {
        success: true,
        data: completeConfig
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
  saveLLMSettings(@Body() body: { provider: string; settings: any }) {
    try {
      // 使用固定的用户ID（与智能日历保持一致）
      const userId = 'cmmc03v95m7xzqxwewhjt';
      const { provider, settings } = body;
      
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
  getEmbeddingSettings() {
    try {
      // 使用固定的用户ID（与智能日历保持一致）
      const userId = 'cmmc03v95m7xzqxwewhjt';
      const settings = this.unifiedSettingsService.getEmbeddingSettings(userId);
      return {
        success: true,
        data: settings
      };
    } catch (error) {
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
  saveEmbeddingSettings(@Body() settings: any) {
    try {
      // 使用固定的用户ID（与智能日历保持一致）
      const userId = 'cmmc03v95m7xzqxwewhjt';
      
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
  getRerankingSettings() {
    try {
      // 使用固定的用户ID（与智能日历保持一致）
      const userId = 'cmmc03v95m7xzqxwewhjt';
      const settings = this.unifiedSettingsService.getRerankingSettings(userId);
      return {
        success: true,
        data: settings
      };
    } catch (error) {
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
  saveRerankingSettings(@Body() settings: any) {
    try {
      // 使用固定的用户ID（与智能日历保持一致）
      const userId = 'cmmc03v95m7xzqxwewhjt';
      
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
}
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; // 假设 PrismaService 在 src/prisma 目录下
import { UserSettings as PrismaUserSettings } from '@prisma/client';
import {
  LLMSettingsDto,
  EmbeddingModelSettingsDto,
  RerankingSettingsDto,
  UISettingsDto,
  UpdateUserSettingsDto,
} from './dto/update-user-settings.dto';

// 从 frontend/src/contexts/SettingsContext.tsx 获取的默认值
const defaultLLMSettings: LLMSettingsDto = {
  provider: 'openai',
  apiKey: '', // API Key 在这里是占位符，实际不应返回给前端
  model: 'gpt-3.5-turbo',
  temperature: 0.7,
  maxTokens: 1000,
  useCustomModel: false,
  customEndpoint: '',
};

const defaultEmbeddingSettings: EmbeddingModelSettingsDto = {
  provider: 'siliconflow',
  apiKey: '', // API Key 在这里是占位符
  model: 'BAAI/bge-large-zh-v1.5',
  encodingFormat: 'float',
  customEndpoint: '',
};

const defaultRerankingSettings: RerankingSettingsDto = {
  enableReranking: false,
  rerankingProvider: 'siliconflow',
  rerankingModel: 'BAAI/bge-reranker-v2-m3',
  initialRerankCandidates: 50,
  finalRerankTopN: 5,
  rerankingCustomEndpoint: '',
};

const defaultUISettings: UISettingsDto = {
  darkMode: false,
  fontSize: 'medium',
  saveConversationHistory: true,
  customEndpoint: '',
};

export type SecureUserSettings = Omit<LLMSettingsDto, 'apiKey'> & 
                                 Omit<EmbeddingModelSettingsDto, 'apiKey'>;


@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  // 辅助函数：深度合并对象，用于合并默认设置和数据库设置
  private deepMerge<T extends object>(target: Partial<T>, ...sources: Partial<T>[]): T {
    const output = { ...target } as T;
    for (const source of sources) {
      if (this.isObject(source)) {
        for (const key in source) {
          if (this.isObject(source[key])) {
            if (!(key in output) || !this.isObject(output[key])) {
              (output as any)[key] = {};
            }
            (output as any)[key] = this.deepMerge((output as any)[key] || {}, source[key] as any);
          } else {
            (output as any)[key] = source[key];
          }
        }
      }
    }
    return output;
  }

  private isObject(item: any): item is object {
    return item && typeof item === 'object' && !Array.isArray(item);
  }

  async getUserSettings(userId: string): Promise<{
    llmSettings: Omit<LLMSettingsDto, 'apiKey'>;
    embeddingSettings: Omit<EmbeddingModelSettingsDto, 'apiKey'>;
    rerankingSettings: RerankingSettingsDto;
    uiSettings: UISettingsDto;
  }> {
    const userSettings = await this.prisma.userSettings.findUnique({
      where: { userId },
    });

    // 从数据库解析的设置，如果为 null 则为空对象
    const dbLLMSettings = userSettings?.llmSettings ? JSON.parse(userSettings.llmSettings as string) as LLMSettingsDto : {};
    const dbEmbeddingSettings = userSettings?.embeddingSettings ? JSON.parse(userSettings.embeddingSettings as string) as EmbeddingModelSettingsDto : {};
    const dbRerankingSettings = userSettings?.rerankingSettings ? JSON.parse(userSettings.rerankingSettings as string) as RerankingSettingsDto : {};
    const dbUISettings = userSettings?.uiSettings ? JSON.parse(userSettings.uiSettings as string) as UISettingsDto : {};
    
    // 合并默认设置和数据库中的设置
    const llmSettings = this.deepMerge({}, defaultLLMSettings, dbLLMSettings);
    const embeddingSettings = this.deepMerge({}, defaultEmbeddingSettings, dbEmbeddingSettings);
    const rerankingSettings = this.deepMerge({}, defaultRerankingSettings, dbRerankingSettings);
    const uiSettings = this.deepMerge({}, defaultUISettings, dbUISettings);

    // 移除 API 密钥后返回
    const { apiKey: llmApiKey, ...secureLlmSettings } = llmSettings;
    const { apiKey: embeddingApiKey, ...secureEmbeddingSettings } = embeddingSettings;

    return {
      llmSettings: secureLlmSettings,
      embeddingSettings: secureEmbeddingSettings,
      rerankingSettings,
      uiSettings,
    };
  }

  async updateUserSettings(
    userId: string,
    data: UpdateUserSettingsDto,
  ): Promise<PrismaUserSettings> {
    const existingSettings = await this.prisma.userSettings.findUnique({
      where: { userId },
    });

    // 准备要更新或创建的数据
    const newSettingsData: {
      llmSettings?: string;
      embeddingSettings?: string;
      rerankingSettings?: string;
      uiSettings?: string;
    } = {};

    // 合并各个部分的设置，只更新传入的字段
    // 对于 apiKey，只有当 DTO 中明确提供了新值时才更新，否则保留旧值（如果存在）
    
    const currentLLMSettings = existingSettings?.llmSettings ? JSON.parse(existingSettings.llmSettings as string) as LLMSettingsDto : defaultLLMSettings;
    if (data.llmSettings) {
      const updatedLLMSettings = { ...currentLLMSettings, ...data.llmSettings };
      if (data.llmSettings.apiKey === undefined && currentLLMSettings.apiKey) { // 如果 DTO 中没有 apiKey，保留旧的
         updatedLLMSettings.apiKey = currentLLMSettings.apiKey;
      }
      newSettingsData.llmSettings = JSON.stringify(updatedLLMSettings);
    } else if (existingSettings?.llmSettings) {
      newSettingsData.llmSettings = existingSettings.llmSettings as string;
    } else {
      newSettingsData.llmSettings = JSON.stringify(defaultLLMSettings);
    }

    const currentEmbeddingSettings = existingSettings?.embeddingSettings ? JSON.parse(existingSettings.embeddingSettings as string) as EmbeddingModelSettingsDto : defaultEmbeddingSettings;
    if (data.embeddingSettings) {
      const updatedEmbeddingSettings = { ...currentEmbeddingSettings, ...data.embeddingSettings };
       if (data.embeddingSettings.apiKey === undefined && currentEmbeddingSettings.apiKey) { // 如果 DTO 中没有 apiKey，保留旧的
         updatedEmbeddingSettings.apiKey = currentEmbeddingSettings.apiKey;
      }
      newSettingsData.embeddingSettings = JSON.stringify(updatedEmbeddingSettings);
    } else if (existingSettings?.embeddingSettings) {
      newSettingsData.embeddingSettings = existingSettings.embeddingSettings as string;
    } else {
      newSettingsData.embeddingSettings = JSON.stringify(defaultEmbeddingSettings);
    }
    
    const currentRerankingSettings = existingSettings?.rerankingSettings ? JSON.parse(existingSettings.rerankingSettings as string) as RerankingSettingsDto : defaultRerankingSettings;
    if (data.rerankingSettings) {
      newSettingsData.rerankingSettings = JSON.stringify({ ...currentRerankingSettings, ...data.rerankingSettings });
    } else if (existingSettings?.rerankingSettings) {
      newSettingsData.rerankingSettings = existingSettings.rerankingSettings as string;
    } else {
      newSettingsData.rerankingSettings = JSON.stringify(defaultRerankingSettings);
    }

    const currentUISettings = existingSettings?.uiSettings ? JSON.parse(existingSettings.uiSettings as string) as UISettingsDto : defaultUISettings;
    if (data.uiSettings) {
      newSettingsData.uiSettings = JSON.stringify({ ...currentUISettings, ...data.uiSettings });
    } else if (existingSettings?.uiSettings) {
      newSettingsData.uiSettings = existingSettings.uiSettings as string;
    } else {
      newSettingsData.uiSettings = JSON.stringify(defaultUISettings);
    }

    return this.prisma.userSettings.upsert({
      where: { userId },
      update: {
        llmSettings: newSettingsData.llmSettings,
        embeddingSettings: newSettingsData.embeddingSettings,
        rerankingSettings: newSettingsData.rerankingSettings,
        uiSettings: newSettingsData.uiSettings,
      },
      create: {
        userId,
        llmSettings: newSettingsData.llmSettings,
        embeddingSettings: newSettingsData.embeddingSettings,
        rerankingSettings: newSettingsData.rerankingSettings,
        uiSettings: newSettingsData.uiSettings,
      },
    });
  }
}

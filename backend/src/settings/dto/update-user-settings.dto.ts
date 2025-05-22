// backend/src/settings/dto/update-user-settings.dto.ts
import { Type } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsEnum,
  ValidateNested,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

// 这些接口直接从 frontend/src/contexts/SettingsContext.tsx 复制并调整为 DTO 类

export class LLMSettingsDto {
  @IsString()
  provider: string;

  @IsString()
  @IsOptional() // apiKey 可以在更新时不提供，以保留旧值
  apiKey?: string; // 注意：敏感信息

  @IsString()
  model: string;

  @IsNumber()
  @Min(0)
  @Max(2)
  temperature: number;

  @IsNumber()
  @Min(1)
  maxTokens: number;

  @IsString()
  @IsOptional()
  customEndpoint?: string;

  @IsBoolean()
  @IsOptional()
  useCustomModel?: boolean;
}

export enum EmbeddingModelProvider {
  SILICONFLOW = 'siliconflow',
}

export enum EmbeddingEncodingFormat {
  FLOAT = 'float',
  BASE64 = 'base64',
}

export class EmbeddingModelSettingsDto {
  @IsEnum(EmbeddingModelProvider)
  provider: 'siliconflow';

  @IsString()
  @IsOptional() // apiKey 可以在更新时不提供
  apiKey?: string; // 注意：敏感信息

  @IsString()
  model: string;

  @IsEnum(EmbeddingEncodingFormat)
  encodingFormat: 'float' | 'base64';

  @IsString()
  @IsOptional()
  customEndpoint?: string;
}

export enum RerankingModelProvider {
  SILICONFLOW = 'siliconflow',
}

export class RerankingSettingsDto {
  @IsBoolean()
  enableReranking: boolean;

  @IsEnum(RerankingModelProvider)
  rerankingProvider: 'siliconflow';

  @IsString()
  rerankingModel: string;

  @IsNumber()
  @Min(1)
  initialRerankCandidates: number;

  @IsNumber()
  @Min(1)
  finalRerankTopN: number;

  @IsString()
  @IsOptional()
  rerankingCustomEndpoint?: string;
}

export enum UIFontSize {
  SMALL = 'small',
  MEDIUM = 'medium',
  LARGE = 'large',
}

export class UISettingsDto {
  @IsBoolean()
  darkMode: boolean;

  @IsEnum(UIFontSize)
  fontSize: 'small' | 'medium' | 'large';

  @IsBoolean()
  saveConversationHistory: boolean;

  @IsString()
  @IsOptional() // customEndpoint 在前端默认为空字符串，设为可选更合适
  customEndpoint?: string;
}

export class UpdateUserSettingsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => LLMSettingsDto)
  llmSettings?: LLMSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => EmbeddingModelSettingsDto)
  embeddingSettings?: EmbeddingModelSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => RerankingSettingsDto)
  rerankingSettings?: RerankingSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UISettingsDto)
  uiSettings?: UISettingsDto;
} 
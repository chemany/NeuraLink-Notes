import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 本地设置服务
 * 管理灵枢笔记特有的设置，如当前选择的LLM提供商
 */
@Injectable()
export class LocalSettingsService {
  private readonly localSettingsPath = path.join(process.cwd(), 'data', 'local-settings.json');

  /**
   * 确保本地设置文件目录存在
   */
  private ensureLocalSettingsDirectory(): void {
    const dir = path.dirname(this.localSettingsPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * 读取本地设置
   */
  private readLocalSettings(): any {
    try {
      this.ensureLocalSettingsDirectory();
      
      if (fs.existsSync(this.localSettingsPath)) {
        const content = fs.readFileSync(this.localSettingsPath, 'utf-8');
        return JSON.parse(content);
      }
      
      // 默认设置
      const defaultSettings = {
        llm: {
          current_provider: 'builtin'
        },
        updated_at: new Date().toISOString()
      };
      
      this.writeLocalSettings(defaultSettings);
      return defaultSettings;
    } catch (error) {
      console.error('读取本地设置失败:', error);
      return {
        llm: {
          current_provider: 'builtin'
        },
        updated_at: new Date().toISOString()
      };
    }
  }

  /**
   * 写入本地设置
   */
  private writeLocalSettings(settings: any): boolean {
    try {
      this.ensureLocalSettingsDirectory();
      const content = JSON.stringify(settings, null, 2);
      fs.writeFileSync(this.localSettingsPath, content, 'utf-8');
      return true;
    } catch (error) {
      console.error('写入本地设置失败:', error);
      return false;
    }
  }

  /**
   * 获取当前选择的LLM提供商
   */
  getCurrentLLMProvider(): string {
    const settings = this.readLocalSettings();
    return settings.llm?.current_provider || 'builtin';
  }

  /**
   * 设置当前选择的LLM提供商
   */
  setCurrentLLMProvider(provider: string): boolean {
    const settings = this.readLocalSettings();
    
    const updatedSettings = {
      ...settings,
      llm: {
        ...settings.llm,
        current_provider: provider
      },
      updated_at: new Date().toISOString()
    };
    
    return this.writeLocalSettings(updatedSettings);
  }

  /**
   * 获取完整的LLM配置（合并共享配置和本地选择）
   */
  getCompleteLLMConfig(sharedConfig: any): any {
    const currentProvider = this.getCurrentLLMProvider();
    
    return {
      current_provider: currentProvider,
      providers: sharedConfig.providers || {},
      updated_at: sharedConfig.updated_at
    };
  }
}
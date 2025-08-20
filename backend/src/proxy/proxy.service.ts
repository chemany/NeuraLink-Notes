import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { UnifiedSettingsService } from '../unified-settings/unified-settings.service';

@Injectable()
export class ProxyService {
  private builtinConfig: any;

  constructor(private readonly unifiedSettingsService: UnifiedSettingsService) {
    this.loadBuiltinConfig();
  }

  /**
   * 加载内置模型配置
   */
  private loadBuiltinConfig() {
    try {
      const configPath = path.join(__dirname, '../../../../unified-settings-service/config/default-models.json');
      const configData = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(configData);
      
      // 优先使用灵枢笔记专用模型，如果不存在则使用通用模型
      this.builtinConfig = config.builtin_free_neuralink || config.builtin_free_general || config.builtin_free;
      
      if (this.builtinConfig) {
        console.log('[ProxyService] 已加载内置模型配置:', this.builtinConfig.name);
      } else {
        throw new Error('未找到合适的内置模型配置');
      }
    } catch (error) {
      console.error('[ProxyService] 加载内置模型配置失败:', error);
      // 回退到硬编码配置
      this.builtinConfig = {
        name: '回退内置模型',
        api_key: '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',
        base_url: 'https://openrouter.ai/api/v1',
        model_name: 'deepseek/deepseek-chat-v3-0324:free',
        max_tokens: 4000,
        temperature: 0.7
      };
      console.log('[ProxyService] 使用回退配置');
    }
  }

  /**
   * 代理内置模型的聊天请求
   */
  async proxyBuiltinChatRequest(body: any, headers: any, res: Response) {
    console.log('[ProxyService] 开始代理内置模型请求');

    if (!this.builtinConfig || !this.builtinConfig.api_key) {
      throw new Error('内置模型配置未找到或API密钥缺失');
    }

    // 构建请求体，确保使用正确的模型名称
    const requestBody = {
      ...body,
      model: this.builtinConfig.model_name,
    };

    // 构建请求头
    const requestHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.builtinConfig.api_key}`,
      'HTTP-Referer': headers['referer'] || 'https://localhost:3000',
      'X-Title': 'LingShu-Notes',
    };

    // 构建完整的API端点
    const apiEndpoint = `${this.builtinConfig.base_url}/chat/completions`;
    console.log('[ProxyService] 代理到:', apiEndpoint);
    console.log('[ProxyService] 使用模型:', this.builtinConfig.model_name);

    try {
      // 发起代理请求
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(requestBody),
      });

      // 检查响应状态
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ProxyService] API响应错误:', response.status, errorText);
        throw new Error(`API请求失败: ${response.status} ${errorText}`);
      }

      // 设置响应头
      res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json');

      // 如果是流式响应
      if (requestBody.stream) {
        console.log('[ProxyService] 处理流式响应');
        res.setHeader('Transfer-Encoding', 'chunked');
        
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('无法读取响应流');
        }

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            // 将数据写入响应流
            res.write(value);
          }
        } finally {
          reader.releaseLock();
          res.end();
        }
      } else {
        // 非流式响应
        console.log('[ProxyService] 处理非流式响应');
        const responseData = await response.json();
        res.json(responseData);
      }
    } catch (error) {
      console.error('[ProxyService] 代理请求失败:', error);
      throw error;
    }
  }

  /**
   * 代理自定义模型的聊天请求
   */
  async proxyCustomChatRequest(body: any, headers: any, res: Response) {
    console.log('[ProxyService] 开始代理自定义模型请求');

    // 从请求体中获取用户token，然后获取自定义LLM配置
    const userId = body.userId;
    if (!userId) {
      throw new Error('用户ID缺失，无法获取自定义模型配置');
    }

    // 获取用户的自定义LLM配置
    const llmConfig = await this.unifiedSettingsService.getLLMSettings(userId);
    console.log('[ProxyService] 获取到的LLM配置:', llmConfig);

    if (!llmConfig || !llmConfig.api_key || !llmConfig.custom_endpoint) {
      throw new Error('自定义模型配置不完整，缺少API密钥或端点');
    }

    // 构建请求体，确保使用正确的模型名称
    const modelName = llmConfig.model_name || llmConfig.model || body.model;
    const requestBody = {
      ...body,
      model: modelName,
    };

    // 移除userId，避免传递给外部API
    delete requestBody.userId;

    // 构建请求头
    const requestHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${llmConfig.api_key}`,
      'HTTP-Referer': headers['referer'] || 'https://www.cheman.top',
      'X-Title': 'LingShu-Notes',
    };

    // 构建完整的API端点，处理URL路径拼接
    let baseUrl = llmConfig.custom_endpoint;
    if (baseUrl.endsWith('/')) {
      baseUrl = baseUrl.slice(0, -1); // 移除尾部斜杠
    }
    const apiEndpoint = `${baseUrl}/chat/completions`;
    console.log('[ProxyService] 代理自定义模型到:', apiEndpoint);
    console.log('[ProxyService] 使用自定义模型:', modelName);

    try {
      // 发起代理请求
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(requestBody),
      });

      // 检查响应状态
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ProxyService] 自定义模型API响应错误:', response.status, errorText);
        throw new Error(`自定义模型API请求失败: ${response.status} ${errorText}`);
      }

      // 设置响应头
      res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json');

      // 如果是流式响应
      if (requestBody.stream) {
        console.log('[ProxyService] 处理自定义模型流式响应');
        res.setHeader('Transfer-Encoding', 'chunked');
        
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('无法读取自定义模型响应流');
        }

        const decoder = new TextDecoder();
        let totalChunks = 0;
        let totalBytes = 0;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              console.log(`[ProxyService] 自定义模型流式响应完成，共${totalChunks}个数据块，${totalBytes}字节`);
              break;
            }
            
            totalChunks++;
            totalBytes += value.length;
            
            // 解码并记录流式数据以便调试
            const chunkText = decoder.decode(value, { stream: true });
            if (totalChunks <= 5 || totalChunks % 10 === 0) {
              console.log(`[ProxyService] 流式数据块${totalChunks} (${value.length}字节):`, chunkText.substring(0, 100));
            }
            
            // 将原始数据写入响应流（保持兼容性）
            // 增加错误处理和显式刷新以提高不同模型的兼容性
            try {
              const writeSuccess = res.write(value);
              if (!writeSuccess) {
                // 如果缓冲区满了，等待drain事件
                await new Promise((resolve) => res.once('drain', resolve));
              }
              // 对于某些模型提供商，显式刷新可能有助于流式响应
              if (typeof res.flushHeaders === 'function' && totalChunks === 1) {
                res.flushHeaders();
              }
            } catch (writeError) {
              console.error(`[ProxyService] 写入流式数据时出错:`, writeError);
              throw writeError;
            }
          }
        } finally {
          reader.releaseLock();
          res.end();
        }
      } else {
        // 非流式响应
        console.log('[ProxyService] 处理自定义模型非流式响应');
        const responseData = await response.json();
        res.json(responseData);
      }
    } catch (error) {
      console.error('[ProxyService] 自定义模型代理请求失败:', error);
      throw error;
    }
  }
} 
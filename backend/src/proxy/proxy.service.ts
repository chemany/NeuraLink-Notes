import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ProxyService {
  private builtinConfig: any;

  constructor() {
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
      this.builtinConfig = config.builtin_free;
      console.log('[ProxyService] 已加载内置模型配置');
    } catch (error) {
      console.error('[ProxyService] 加载内置模型配置失败:', error);
      // 回退到硬编码配置
      this.builtinConfig = {
        api_key: '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',
        base_url: 'https://openrouter.ai/api/v1',
        model_name: 'deepseek/deepseek-chat-v3-0324:free',
      };
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
} 
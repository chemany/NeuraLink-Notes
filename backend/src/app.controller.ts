import { Controller, Get, Post, Body, Res } from '@nestjs/common';
import { Response } from 'express';
import { AppService } from './app.service';
import * as fs from 'fs';
import * as path from 'path';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      service: 'Notebook LM Backend',
      timestamp: new Date().toISOString(),
      version: '2.0.0'
    };
  }

  @Get('dev-tools-silence')
  devToolsSilence(@Res() res: Response): void {
    // 静默处理开发工具和Chrome扩展的请求，避免404日志
    res.status(204).send();
  }

  @Post('proxy/builtin-chat')
  async proxyBuiltinChat(@Body() body: any, @Res() res: Response) {
    console.log('[AppController] 收到内置模型代理请求');
    
    try {
      // 加载内置模型配置 - 指向统一设置服务的配置文件
      const configPath = path.join(__dirname, '../../../unified-settings-service/config/default-models.json');
      let builtinConfig: any;
      
      try {
        const configData = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(configData);
        builtinConfig = config.builtin_free;
        console.log('[AppController] 已加载内置模型配置');
      } catch (error) {
        console.error('[AppController] 加载配置失败，使用硬编码配置:', error);
        builtinConfig = {
          api_key: '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',
          base_url: 'https://openrouter.ai/api/v1',
          model_name: 'deepseek/deepseek-chat-v3-0324:free'
        };
      }

      // 构建请求
      const requestBody = {
        model: builtinConfig.model_name,
        messages: body.messages,
        temperature: body.temperature || 0.7,
        max_tokens: body.max_tokens || 1500,
        stream: body.stream || false
      };

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${builtinConfig.api_key}`,
        'HTTP-Referer': 'https://notebook-lm-clone.example.com',
        'X-Title': 'LingShu-Notes'
      };

      // 构建完整的API端点
      const apiEndpoint = `${builtinConfig.base_url}/chat/completions`;
      console.log('[AppController] 代理请求到:', apiEndpoint);

      // 发送请求到外部API
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });

      console.log('[AppController] 外部API响应状态:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[AppController] 外部API错误:', errorText);
        return res.status(response.status).json({ error: errorText });
      }

      // 转发响应
      if (body.stream) {
        // 流式响应
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        
        const reader = response.body?.getReader();
        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
          }
        }
        res.end();
      } else {
        // 非流式响应
        const responseData = await response.json();
        res.json(responseData);
      }
    } catch (error) {
      console.error('[AppController] 代理请求失败:', error);
      res.status(500).json({
        error: 'Proxy request failed',
        message: error.message
      });
    }
  }
}

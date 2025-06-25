import { Controller, Post, Body, Headers, Res } from '@nestjs/common';
import { Response } from 'express';
import { ProxyService } from './proxy.service';

@Controller('api/proxy')
export class ProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  @Post('builtin-chat')
  async proxyBuiltinChat(
    @Body() body: any,
    @Headers() headers: any,
    @Res() res: Response,
  ) {
    console.log('[ProxyController] 代理内置模型聊天请求');
    
    try {
      // 调用代理服务处理请求
      await this.proxyService.proxyBuiltinChatRequest(body, headers, res);
    } catch (error) {
      console.error('[ProxyController] 代理请求失败:', error);
      res.status(500).json({
        error: 'Proxy request failed',
        message: error.message,
      });
    }
  }
} 
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { UnifiedAuthService, UnifiedUser } from './unified-auth.service';

// 扩展Request接口以包含用户信息
export interface AuthenticatedRequest extends Request {
  user: UnifiedUser;
}

/**
 * 统一认证守卫
 * 替代原有的JWT认证，使用统一设置服务验证token
 */
@Injectable()
export class UnifiedAuthGuard implements CanActivate {
  constructor(private unifiedAuthService: UnifiedAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      console.log('[UnifiedAuthGuard] 未提供认证token');
      throw new UnauthorizedException('用户未认证或 Token 无效');
    }

    try {
      console.log('[UnifiedAuthGuard] 验证token...');
      const verification = await this.unifiedAuthService.verifyToken(token);
      
      if (!verification.valid || !verification.user) {
        console.log('[UnifiedAuthGuard] token验证失败');
        throw new UnauthorizedException('用户未认证或 Token 无效');
      }

      // 将用户信息附加到请求对象
      request.user = verification.user;
      console.log('[UnifiedAuthGuard] 认证成功，用户:', verification.user.email);
      return true;
    } catch (error) {
      console.error('[UnifiedAuthGuard] 认证错误:', error.message);
      throw new UnauthorizedException('用户未认证或 Token 无效');
    }
  }

  /**
   * 从请求头中提取Bearer token
   * @param request HTTP请求对象
   * @returns token字符串或undefined
   */
  private extractTokenFromHeader(request: Request): string | undefined {
    const authorization = request.headers.authorization;
    if (!authorization) {
      return undefined;
    }

    const [type, token] = authorization.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
} 
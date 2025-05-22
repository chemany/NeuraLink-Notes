import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    // 为 canActivate 添加自定义的错误处理逻辑 (可选)
    // 例如，如果 JWT 验证失败，默认会抛出 UnauthorizedException
    // 您可以在这里捕获它并抛出自定义的异常或记录日志
    return super.canActivate(context);
  }

  handleRequest(err, user, info) {
    // 您可以覆盖 handleRequest 方法来自定义当认证失败或发生错误时的行为
    if (err || !user) {
      // info 可以包含关于验证失败的更多信息，例如 TokenExpiredError
      // console.error('JWT Auth Error:', info?.message || info);
      throw err || new UnauthorizedException('用户未认证或 Token 无效');
    }
    return user; // 如果认证成功，返回 user 对象
  }
} 
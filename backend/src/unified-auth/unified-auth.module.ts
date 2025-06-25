import { Module } from '@nestjs/common';
import { UnifiedAuthService } from './unified-auth.service';
import { UnifiedAuthGuard } from './unified-auth.guard';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * 统一认证模块
 * 用于与统一设置服务(localhost:3002)对接认证，并同步用户到本地数据库
 */
@Module({
  imports: [PrismaModule],
  providers: [UnifiedAuthService, UnifiedAuthGuard],
  exports: [UnifiedAuthService, UnifiedAuthGuard],
})
export class UnifiedAuthModule {} 
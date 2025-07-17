import { Module } from '@nestjs/common';
import { NotesService } from './notes.service';
import { NotesController } from './notes.controller';
import { UnifiedAuthModule } from '../unified-auth/unified-auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';

/**
 * NotesModule 负责富文本笔记相关的依赖注入和路由注册
 */
@Module({
  imports: [UnifiedAuthModule, PrismaModule, ConfigModule], // 导入统一认证模块、数据库模块和配置模块
  controllers: [NotesController], // 注册富文本笔记控制器
  providers: [NotesService], // 注册富文本笔记服务
  exports: [NotesService], // 可选：如果其他模块需要使用 NotesService
})
export class NotesModule {}

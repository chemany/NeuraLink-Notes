import { Module } from '@nestjs/common';
import { NotesService } from './notes.service';
import { NotesController } from './notes.controller';
import { UnifiedAuthModule } from '../unified-auth/unified-auth.module';

/**
 * NotesModule 负责富文本笔记相关的依赖注入和路由注册
 */
@Module({
  imports: [UnifiedAuthModule], // 导入统一认证模块
  controllers: [NotesController], // 注册富文本笔记控制器
  providers: [NotesService], // 注册富文本笔记服务
  exports: [NotesService], // 可选：如果其他模块需要使用 NotesService
})
export class NotesModule {}

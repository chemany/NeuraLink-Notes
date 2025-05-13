import { Module } from '@nestjs/common';
// import { BullModule } from '@nestjs/bullmq';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { DocumentsProcessor } from './documents.processor';
import { DocumentProcessingScheduler } from './document-processing.scheduler';
import { ConfigModule } from '@nestjs/config';
// import { DOCUMENT_PROCESSING_QUEUE } from '../app.module';
// PrismaModule 是全局的，所以这里通常不需要显式导入
// import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    ConfigModule,
    // Remove BullModule.registerQueue
    // BullModule.registerQueue({ name: DOCUMENT_PROCESSING_QUEUE }),
  ],
  controllers: [DocumentsController], // 声明此模块的控制器
  providers: [
    DocumentsService,
    DocumentsProcessor,
    DocumentProcessingScheduler,
  ], // 声明此模块的服务
  // 因为 PrismaModule 是 @Global()，所以 DocumentsService 可以直接注入 PrismaService
  // 如果 PrismaModule 不是全局的，则需要取消下面这行的注释：
  // imports: [PrismaModule],
})
export class DocumentsModule {} // 确保导出 DocumentsModule 类

import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentsProcessor } from './documents.processor'; // 引入包含处理逻辑的服务

@Injectable()
export class DocumentProcessingScheduler {
  private readonly logger = new Logger(DocumentProcessingScheduler.name);
  private isProcessing = false; // 添加一个锁，防止并发处理

  constructor(
    private prisma: PrismaService,
    private documentsProcessor: DocumentsProcessor, // 注入处理服务
  ) {}

  @Interval(15000) // 设置轮询间隔为 15 秒 (15000 毫秒)
  async handlePendingDocuments() {
    // 如果已经在处理，则跳过本次轮询
    if (this.isProcessing) {
      this.logger.debug('Skipping check as processing is already in progress.');
      return;
    }

    this.isProcessing = true; // 设置处理锁
    this.logger.log('Checking for pending documents...');

    try {
      // 查找一个状态为 PENDING 的文档
      const pendingDocument = await this.prisma.document.findFirst({
        where: {
          status: 'PENDING',
        },
        orderBy: {
          createdAt: 'asc', // 优先处理最早创建的
        },
      });

      if (pendingDocument) {
        this.logger.log(
          `Found pending document: ${pendingDocument.id}. Starting processing...`,
        );
        try {
          // 调用处理逻辑
          await this.documentsProcessor.handleDocumentProcessing({
            documentId: pendingDocument.id,
          });
          this.logger.log(
            `Successfully processed document: ${pendingDocument.id}`,
          );
        } catch (error) {
          // 处理器内部已经记录了详细错误并更新了状态为 FAILED
          this.logger.error(
            `Error processing document ${pendingDocument.id} in scheduler: ${error.message}`,
          );
          // 注意：这里我们不重新抛出错误，允许调度器继续检查下一个
        }
      } else {
        this.logger.log('No pending documents found.');
      }
    } catch (error) {
      this.logger.error(
        `Error fetching pending documents: ${error.message}`,
        error.stack,
      );
    } finally {
      this.isProcessing = false; // 释放处理锁
    }
  }
}

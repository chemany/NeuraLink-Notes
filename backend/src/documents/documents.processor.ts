// backend/src/documents/documents.processor.ts
// No longer import Processor from @nestjs/bullmq
// No longer import Job, Process, WorkerHost from 'bullmq'

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
// PDF parsing library
import * as pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';
// import * as officeparser from 'officeparser'; // DISABLED for pdfjs dependency
// Keep queue name import if needed elsewhere, otherwise remove
// import { DOCUMENT_PROCESSING_QUEUE } from '../app.module';

// 添加XLSX导入
import * as XLSX from 'xlsx';

// Interface for the job data payload
interface DocumentJobPayload {
  documentId: string;
}

@Injectable()
// No longer extends WorkerHost
export class DocumentsProcessor {
  private readonly logger = new Logger(DocumentsProcessor.name);
  private readonly _uploadPath: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    // No longer call super()
    this._uploadPath = this.configService.get<string>(
      'UPLOAD_PATH',
      './uploads',
    );
  }

  // Make this a public method that can be called by the manual worker
  // No longer use @Process decorator
  public async handleDocumentProcessing(
    data: DocumentJobPayload,
  ): Promise<void> {
    const { documentId } = data; // Directly receive the payload
    this.logger.log(`[ProcessorLogic] 开始处理文档: ${documentId}`); // Changed log prefix

    let document;
    try {
      // 1. 获取文档记录
      document = await this.prisma.document.findUnique({
        where: { id: documentId },
      });

      if (!document || !document.filePath) {
        throw new Error(`文档 ${documentId} 未找到或缺少文件路径`);
      }

      // 2. 更新状态为 PROCESSING
      await this.prisma.document.update({
        where: { id: documentId },
        data: { status: 'PROCESSING', statusMessage: '开始提取文本' },
      });
      this.logger.log(`[ProcessorLogic] 更新状态为 PROCESSING: ${documentId}`);

      // 3. 构建完整文件路径
      const absoluteFilePath = path.resolve(document.filePath);
      if (!fs.existsSync(absoluteFilePath)) {
        throw new Error(`文件在路径 ${absoluteFilePath} 未找到`);
      }
      this.logger.log(`[ProcessorLogic] 找到文件: ${absoluteFilePath}`);

      // 4. 根据文件类型提取文本
      let textContent = '';
      const fileExtension = path.extname(document.fileName).toLowerCase();
      this.logger.log(`[ProcessorLogic] 文件扩展名: ${fileExtension}`);

      await this.prisma.document.update({
        where: { id: documentId },
        data: { statusMessage: `正在提取 ${fileExtension} 文本...` },
      });

      if (fileExtension === '.pdf') {
        try {
          const dataBuffer = fs.readFileSync(absoluteFilePath);
          const data = await pdfParse(dataBuffer);
          textContent = data.text || '';
          this.logger.log(
            `[ProcessorLogic] 从 PDF 提取文本完成 (长度: ${textContent?.length ?? 0})`,
          );
        } catch (error) {
          this.logger.error(`[ProcessorLogic] PDF 文本提取失败:`, error);
          textContent = `PDF文本提取失败: ${error instanceof Error ? error.message : '未知错误'}`;
        }
      } else if (fileExtension === '.docx') {
        const result = await mammoth.extractRawText({ path: absoluteFilePath });
        textContent = result.value;
        this.logger.log(
          `[ProcessorLogic] 从 DOCX 提取文本完成 (长度: ${textContent?.length ?? 0})`,
        );
      } else if (fileExtension === '.pptx') {
        try {
          // 使用textract提取PPTX内容
          const textract = require('textract');
          const util = require('util');
          const textractPromise = util.promisify(textract.fromBufferWithName);

          const dataBuffer = fs.readFileSync(absoluteFilePath);
          const extractedText = await textractPromise(document.fileName, dataBuffer, { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });

          textContent = extractedText?.trim() || '';
          this.logger.log(
            `[ProcessorLogic] 从 PPTX 提取文本完成 (长度: ${textContent?.length ?? 0})`,
          );
        } catch (error) {
          this.logger.error(`[ProcessorLogic] PPTX 文本提取失败:`, error);
          textContent = `PPTX文本提取失败: ${error instanceof Error ? error.message : '未知错误'}`;
        }
      } else if (fileExtension === '.txt') {
        textContent = fs.readFileSync(absoluteFilePath, 'utf8');
        this.logger.log(
          `[ProcessorLogic] 从 TXT 提取文本完成 (长度: ${textContent?.length ?? 0})`,
        );
      } else if (fileExtension === '.xlsx') {
        const workbook = XLSX.readFile(absoluteFilePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet);
        textContent = JSON.stringify(data, null, 2);
        this.logger.log(
          `[ProcessorLogic] 从 XLSX 提取文本完成 (长度: ${textContent?.length ?? 0})`,
        );
      } else if (fileExtension === '.csv') {
        textContent = fs.readFileSync(absoluteFilePath, 'utf8');
        this.logger.log(
          `[ProcessorLogic] 从 CSV 提取文本完成 (长度: ${textContent?.length ?? 0})`,
        );
      } else {
        this.logger.warn(
          `[ProcessorLogic] 不支持的文件类型: ${fileExtension}，无法提取文本。`,
        );
        textContent = '';
      }

      // 5. 更新状态为 COMPLETED 并保存文本内容
      await this.prisma.document.update({
        where: { id: documentId },
        data: {
          status: 'COMPLETED',
          textContent: textContent || '',
          statusMessage: '文本提取完成',
        },
      });
      this.logger.log(
        `[ProcessorLogic] 更新状态为 COMPLETED 并保存文本: ${documentId}`,
      );
    } catch (error) {
      this.logger.error(
        `[ProcessorLogic] 处理文档 ${documentId} 时出错: ${error.message}`,
        error.stack,
      );
      // 更新状态为 FAILED
      try {
        if (documentId) {
          await this.prisma.document.update({
            where: { id: documentId },
            data: {
              status: 'FAILED',
              statusMessage: `处理失败: ${error.message}`,
            },
          });
        }
      } catch (updateError) {
        this.logger.error(
          `[ProcessorLogic] 更新文档 ${documentId} 状态为 FAILED 时也出错: ${updateError.message}`,
        );
      }
      // Let the worker handle the job failure; re-throw the error
      throw error;
    }
  }
}

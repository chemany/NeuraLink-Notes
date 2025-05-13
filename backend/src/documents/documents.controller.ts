import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  HttpCode,
  HttpStatus,
  Body,
  BadRequestException,
  Get,
  Param,
  NotFoundException,
  Delete,
  Res,
  StreamableFile,
  Logger,
  InternalServerErrorException,
  Query,
  Patch
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service';
import { Document } from '@prisma/client';
import { Express } from 'express';
import type { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as mime from 'mime-types';
import { createReadStream } from 'fs';
import { SaveVectorDataDto } from './dto/save-vector-data.dto';

@Controller('documents')
export class DocumentsController {
  private readonly logger = new Logger(DocumentsController.name);

  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.CREATED)
  async uploadFile(
    @Query('notebookId') notebookId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 100 * 1024 * 1024 }),
        ],
        fileIsRequired: true,
      }),
    ) file: Express.Multer.File,
    @Body('originalName') originalNameFromForm?: string
  ): Promise<Document> {
    this.logger.log(`[DocumentsController] Received upload request. NotebookID (query): ${notebookId}, File: ${file.originalname}, OriginalName (form): ${originalNameFromForm}`);

    if (!notebookId) {
       this.logger.error('[DocumentsController] Missing notebookId in query parameters.');
       throw new BadRequestException('缺少 notebookId 查询参数');
    }
    if (!file) {
         this.logger.error('[DocumentsController] File object is missing after interceptor.');
         throw new BadRequestException('缺少文件');
    }
    
    const nameToUse = originalNameFromForm || file.originalname;
    this.logger.log(`[DocumentsController] Using filename: ${nameToUse} (Source: ${originalNameFromForm ? 'Form Body' : 'file.originalname'})`);
    
    return this.documentsService.create(notebookId, file, nameToUse);
  }

  @Get('notebook/:notebookId')
  findAllByNotebook(@Param('notebookId') notebookId: string): Promise<Document[]> {
    this.logger.log(`Finding all documents for notebook: ${notebookId}`);
    return this.documentsService.findAllByNotebook(notebookId);
  }

  @Get(':id/content')
  @HttpCode(HttpStatus.OK)
  async getDocumentContent(
      @Param('id') id: string
  ): Promise<string | null> {
      this.logger.log(`[Controller] Received request for GET /documents/${id}/content`);
      
      try {
          const content = await this.documentsService.getDocumentContent(id);
          
          if (content === null) {
              this.logger.warn(`[Controller] Content for document ${id} not found`);
              throw new NotFoundException(`ID 为 ${id} 的文档内容未找到`);
          }
          
          if (typeof content !== 'string') {
              this.logger.warn(`[Controller] Content for document ${id} is not a string type: ${typeof content}`);
              throw new NotFoundException(`无法以文本形式提供文档 ${id} 的内容`);
          }
          
          this.logger.log(`[Controller] Successfully returning content for document ${id}, length: ${content.length}`);
          return content;
      } catch (error) {
          this.logger.error(`[Controller] Error getting document content for ${id}: ${error.message}`);
          
          // 保留原始错误类型和状态码
          if (error instanceof NotFoundException) {
              throw error;
          } else if (error instanceof InternalServerErrorException) {
              throw error;
          } else if (error instanceof BadRequestException) {
              throw error;
          }
          
          // 其他未知错误
          throw new InternalServerErrorException(`获取文档内容时发生错误: ${error.message}`);
      }
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Document> {
    this.logger.log(`Finding document details for ID: ${id}`);
    const doc = await this.documentsService.findOne(id);
    if (!doc) {
       this.logger.error(`Service findOne for ID ${id} returned null without throwing.`);
       throw new NotFoundException(`ID 为 ${id} 的文档未找到`);
    }
    return doc;
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<Document> {
    this.logger.log(`Attempting to delete document: ${id}`);
    return this.documentsService.remove(id);
  }

  @Get(':id/raw')
  async getRawDocumentContent(@Param('id') id: string, @Res() res: Response) {
    try {
      this.logger.log(`[Controller] Received request for raw content of document ${id}`);
      const filePath = await this.documentsService.getDocumentFilePath(id);
      this.logger.log(`[Controller] File path retrieved: ${filePath}`);

      const allowedDirectory = path.resolve(this.documentsService.uploadPath);
      const absoluteFilePath = path.resolve(filePath);
      this.logger.log(`[Controller] Resolved file path: ${absoluteFilePath}`);
      this.logger.log(`[Controller] Allowed directory: ${allowedDirectory}`);

      if (!absoluteFilePath.startsWith(allowedDirectory)) {
          this.logger.error(`[Controller] Attempt to access restricted path: ${absoluteFilePath}`);
          throw new NotFoundException('File access denied');
      }

      if (!fs.existsSync(absoluteFilePath)) {
          this.logger.error(`[Controller] File not found at path: ${absoluteFilePath}`);
          throw new NotFoundException('File not found on server');
      }

      const mimeType = mime.lookup(absoluteFilePath) || 'application/octet-stream';
      this.logger.log(`[Controller] Determined MIME type: ${mimeType}`);

      res.set({
        'Content-Type': mimeType,
        'Content-Disposition': `inline`,
      });

      const fileStream = fs.createReadStream(absoluteFilePath);

      fileStream.on('error', (err) => {
        this.logger.error(`[Controller] Error reading file stream for ${id}:`, err);
        if (!res.headersSent) {
            res.status(500).send('Error reading file');
        }
      });

      this.logger.log(`[Controller] Returning streamable file for ${id}`);
      fileStream.pipe(res);
    } catch (error) {
      this.logger.error(`[Controller] Error in getRawDocumentContent:`, error);
      if (!res.headersSent) {
         if (error instanceof NotFoundException) {
              res.status(HttpStatus.NOT_FOUND).send({ statusCode: HttpStatus.NOT_FOUND, message: error.message });
         } else {
             res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({ statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Error retrieving file' });
         }
      }
    }
  }

  @Get(':id/download')
  async downloadFile(@Param('id') id: string, @Res({ passthrough: true }) res: Response): Promise<StreamableFile> {
    this.logger.log(`Request to download original file for document ID: ${id}`);
    try {
        const filePath = await this.documentsService.getDocumentFilePath(id);
        const fileExists = fs.existsSync(filePath);
        this.logger.log(`File path for document ${id}: ${filePath}, Exists: ${fileExists}`);

        if (!fileExists) {
            this.logger.error(`Physical file not found at path: ${filePath} for document ${id}`);
            throw new NotFoundException(`File not found for document ${id}. It might have been deleted or moved.`);
        }
        
        const fileStream = createReadStream(filePath);
        const mimeType = mime.lookup(filePath) || 'application/octet-stream';
        const fileName = path.basename(filePath);

        res.set({
            'Content-Type': mimeType,
            'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        });

        return new StreamableFile(fileStream);

    } catch (error) {
        this.logger.error(`Error downloading file for document ${id}: ${error.message}`, error.stack);
        if (error instanceof NotFoundException || error instanceof InternalServerErrorException) {
            throw error;
        }
        throw new InternalServerErrorException('Could not download file.');
    }
  }

  @Patch(':id/reprocess')
  @HttpCode(HttpStatus.OK)
  async reprocessDocument(@Param('id') id: string): Promise<Document> {
    this.logger.log(`[Controller] 重新处理文档 ${id} 的请求`);
    try {
      return await this.documentsService.reprocessDocument(id);
    } catch (error) {
      this.logger.error(`[Controller] 重新处理文档 ${id} 时出错: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(`重新处理文档失败: ${error.message}`);
    }
  }
  
  @Get(':id/status')
  @HttpCode(HttpStatus.OK) 
  async getDocumentStatus(@Param('id') id: string): Promise<{ 
    id: string; 
    status: string | null; 
    statusMessage: string | null;
    filePath?: string | null;
    textContentExists: boolean;
    fileExists: boolean;
  }> {
    this.logger.log(`[Controller] 获取文档 ${id} 状态的请求`);
    
    try {
      const document = await this.documentsService.findOne(id);
      if (!document) {
        throw new NotFoundException(`文档 ${id} 未找到`);
      }
      
      // 检查文件是否存在
      let fileExists = false;
      if (document.filePath) {
        fileExists = fs.existsSync(document.filePath);
      }
      
      // 检查是否有文本内容
      const textContentExists = document.textContent != null && document.textContent.length > 0;
      
      return {
        id: document.id,
        status: document.status,
        statusMessage: document.statusMessage,
        filePath: document.filePath,
        textContentExists,
        fileExists
      };
    } catch (error) {
      this.logger.error(`[Controller] 获取文档 ${id} 状态时出错: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(`获取文档状态失败: ${error.message}`);
    }
  }

  @Post(':id/vector-data')
  @HttpCode(HttpStatus.OK)
  async saveVectorData(
    @Param('id') documentId: string,
    @Body() saveVectorDataDto: SaveVectorDataDto,
  ): Promise<{ message: string }> {
    this.logger.log(`[Controller] Received request to save vector data for document ${documentId}`);
    try {
      await this.documentsService.saveVectorData(documentId, saveVectorDataDto.vectorData);
      return { message: 'Vector data saved successfully.' };
    } catch (error) {
      this.logger.error(`[Controller] Error saving vector data for document ${documentId}: ${error.message}`);
      if (error instanceof NotFoundException || error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException(`Failed to save vector data for document ${documentId}.`);
    }
  }

  @Get(':id/vector-data')
  @HttpCode(HttpStatus.OK)
  async getVectorData(@Param('id') documentId: string): Promise<any | null> {
    this.logger.log(`[Controller] Received request to get vector data for document ${documentId}`);
    try {
      const vectorData = await this.documentsService.getVectorData(documentId);
      if (vectorData === null) {
        this.logger.log(`[Controller] Vector data not found for document ${documentId}. Returning null.`);
        return null; 
      }
      return vectorData;
    } catch (error) {
      this.logger.error(`[Controller] Error getting vector data for document ${documentId}: ${error.message}`);
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException(`Failed to retrieve vector data for document ${documentId}.`);
    }
  }
}

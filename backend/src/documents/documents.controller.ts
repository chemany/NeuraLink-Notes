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
  Patch,
  UseGuards,
  Request,
  ForbiddenException
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service';
import { Document, User as UserModel } from '@prisma/client';
import { Express } from 'express';
import type { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as mime from 'mime-types';
import { createReadStream } from 'fs';
import { SaveVectorDataDto } from './dto/save-vector-data.dto';
import { UnifiedAuthGuard, AuthenticatedRequest } from '../unified-auth/unified-auth.guard';
import { Buffer } from 'buffer';

@Controller('documents')
@UseGuards(UnifiedAuthGuard)
export class DocumentsController {
  private readonly logger = new Logger(DocumentsController.name);

  constructor(private readonly documentsService: DocumentsService) {}

  // 将具体路由放在参数路由之前
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
    @Request() req: AuthenticatedRequest,
    @Body('originalName') originalNameFromForm?: string,
  ): Promise<Document> {
    let originalNameToUse = file.originalname;
    try {
      const redecodedName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      this.logger.log(`[DocumentsController] Original file.originalname: "${file.originalname}", Attempted re-decode (latin1->utf8): "${redecodedName}"`);

      const typicalLatin1GarbleChars = ['å', '³', 'é', '®', 'æ', 'ç', 'è', 'ä', 'ö', 'ü'];
      const hasTypicalGarble = typicalLatin1GarbleChars.some(char => file.originalname.includes(char));
      const hasChineseCharsAfterDecode = /[\u4e00-\u9fa5]/.test(redecodedName);

      if (hasTypicalGarble && hasChineseCharsAfterDecode && file.originalname !== redecodedName) {
           this.logger.log(`[DocumentsController] Detected potential UTF-8 mangled as Latin-1. Using re-decoded name: "${redecodedName}"`);
           originalNameToUse = redecodedName;
      } else {
          this.logger.log(`[DocumentsController] Did not use re-decoded name. Original: "${file.originalname}", Decoded: "${redecodedName}", HasGarble: ${hasTypicalGarble}, HasChinese: ${hasChineseCharsAfterDecode}`);
      }

    } catch (e) {
      this.logger.error(`[DocumentsController] Error during filename re-decoding: ${e.message}. Falling back to original.`);
      originalNameToUse = file.originalname;
    }
    
    this.logger.log(`[DocumentsController] Received upload request. NotebookID (query): ${notebookId}, File (processed originalNameToUse): "${originalNameToUse}", OriginalName (form): ${originalNameFromForm}`);
    const userId = req.user.id;

    if (!notebookId) {
       this.logger.error('[DocumentsController] Missing notebookId in query parameters.');
       throw new BadRequestException('缺少 notebookId 查询参数');
    }
    if (!file) {
         this.logger.error('[DocumentsController] File object is missing after interceptor.');
         throw new BadRequestException('缺少文件');
    }
    
    const nameToUse = originalNameFromForm || originalNameToUse;
    this.logger.log(`[DocumentsController] Using filename: ${nameToUse} (Source: ${originalNameFromForm ? 'Form Body' : 'processed originalNameToUse'}) for User ${userId}`);
    
    return this.documentsService.create(notebookId, userId, file, nameToUse);
  }

  @Get('notebook/:notebookId')
  async findAllByNotebook(
    @Param('notebookId') notebookId: string,
    @Request() req: AuthenticatedRequest,
  ): Promise<Document[]> {
    const userId = req.user.id;
    this.logger.log(`User ${userId} finding all documents for notebook: ${notebookId}`);
    return this.documentsService.findAllByNotebook(notebookId, userId);
  }

  @Get(':id/content')
  @HttpCode(HttpStatus.OK)
  async getDocumentContent(
      @Param('id') id: string,
      @Request() req: AuthenticatedRequest,
  ): Promise<string | null> {
      const userId = req.user.id;
      this.logger.log(`[Controller] User ${userId} received request for GET /documents/${id}/content`);
      
      try {
          const content = await this.documentsService.getDocumentContent(id, userId);
          
          if (content === null) {
              this.logger.warn(`[Controller] Content for document ${id} (User ${userId}) not found`);
              throw new NotFoundException(`ID 为 ${id} 的文档内容未找到`);
          }
          
          if (typeof content !== 'string') {
              this.logger.warn(`[Controller] Content for document ${id} (User ${userId}) is not a string type: ${typeof content}`);
              throw new NotFoundException(`无法以文本形式提供文档 ${id} 的内容`);
          }
          
          this.logger.log(`[Controller] Successfully returning content for document ${id} (User ${userId}), length: ${content.length}`);
          return content;
      } catch (error) {
          this.logger.error(`[Controller] User ${userId} error getting document content for ${id}: ${error.message}`);
          
          if (error instanceof NotFoundException) {
              throw error;
          } else if (error instanceof InternalServerErrorException) {
              throw error;
          } else if (error instanceof BadRequestException) {
              throw error;
          }
          
          throw new InternalServerErrorException(`获取文档内容时发生错误: ${error.message}`);
      }
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ): Promise<Document> {
    const userId = req.user.id;
    this.logger.log(`User ${userId} finding document details for ID: ${id}`);
    const doc = await this.documentsService.findOne(id, userId);
    if (!doc) {
       this.logger.error(`Service findOne for ID ${id} (User ${userId}) returned null without throwing.`);
       throw new NotFoundException(`ID 为 ${id} 的文档未找到`);
    }
    return doc;
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ): Promise<Document> {
    const userId = req.user.id;
    this.logger.log(`User ${userId} attempting to delete document: ${id}`);
    return this.documentsService.remove(id, userId);
  }

  @Get(':id/raw')
  async getRawDocumentContent(
    @Param('id') id: string,
    @Res() res: Response,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = req.user.id;
    try {
      this.logger.log(`[Controller] User ${userId} received request for raw content of document ${id}`);
      const document = await this.documentsService.findOne(id, userId);
      if (!document || !document.filePath) {
        throw new NotFoundException('文档或文件路径未找到。');
      }
      const filePath = document.filePath;
      this.logger.log(`[Controller] User ${userId} file path retrieved: ${filePath}`);

      const allowedDirectory = path.resolve(this.documentsService.uploadPath);
      const absoluteFilePath = path.resolve(filePath);
      this.logger.log(`[Controller] User ${userId} resolved file path: ${absoluteFilePath}`);
      this.logger.log(`[Controller] User ${userId} allowed directory: ${allowedDirectory}`);

      if (!absoluteFilePath.startsWith(allowedDirectory)) {
          this.logger.error(`[Controller] User ${userId} attempt to access restricted path: ${absoluteFilePath}`);
          throw new ForbiddenException('File access denied');
      }

      if (!fs.existsSync(absoluteFilePath)) {
          this.logger.error(`[Controller] File not found at path for User ${userId}: ${absoluteFilePath}`);
          throw new NotFoundException('File not found on server');
      }

      const mimeType = mime.lookup(absoluteFilePath) || 'application/octet-stream';
      this.logger.log(`[Controller] User ${userId} determined MIME type: ${mimeType}`);

      res.set({
        'Content-Type': mimeType,
        'Content-Disposition': `inline`,
      });

      const fileStream = fs.createReadStream(absoluteFilePath);

      fileStream.on('error', (err) => {
        this.logger.error(`[Controller] Error reading file stream for ${id} (User ${userId}):`, err);
        if (!res.headersSent) {
            res.status(500).send('Error reading file');
        }
      });

      this.logger.log(`[Controller] Returning streamable file for ${id} (User ${userId})`);
      fileStream.pipe(res);
    } catch (error) {
      this.logger.error(`[Controller] User ${userId} error in getRawDocumentContent:`, error);
      if (!res.headersSent) {
         if (error instanceof NotFoundException) {
              res.status(HttpStatus.NOT_FOUND).send({ statusCode: HttpStatus.NOT_FOUND, message: error.message });
         } else if (error instanceof ForbiddenException) {
              res.status(HttpStatus.FORBIDDEN).send({ statusCode: HttpStatus.FORBIDDEN, message: error.message });
         } else {
             res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({ statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Error retrieving file' });
         }
      }
    }
  }

  @Get(':id/download')
  async downloadFile(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
    @Request() req: AuthenticatedRequest,
  ): Promise<StreamableFile> {
    const userId = req.user.id;
    this.logger.log(`User ${userId} request to download original file for document ID: ${id}`);
    try {
        const document = await this.documentsService.findOne(id, userId);
        if (!document || !document.filePath) {
            throw new NotFoundException(`File not found for document ${id}. It might have been deleted or moved.`);
        }
        const filePath = document.filePath;
        const fileExists = fs.existsSync(filePath);
        this.logger.log(`File path for document ${id} (User ${userId}): ${filePath}, Exists: ${fileExists}`);

        if (!fileExists) {
            this.logger.error(`Physical file not found at path: ${filePath} for document ${id} (User ${userId})`);
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
        this.logger.error(`Error downloading file for document ${id} (User ${userId}): ${error.message}`, error.stack);
        if (error instanceof NotFoundException || error instanceof InternalServerErrorException) {
            throw error;
        }
        throw new InternalServerErrorException('Could not download file.');
    }
  }

  @Patch(':id/reprocess')
  @HttpCode(HttpStatus.OK)
  async reprocessDocument(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ): Promise<Document> {
    const userId = req.user.id;
    this.logger.log(`[Controller] User ${userId} reprocess document ${id} request`);
    try {
      return await this.documentsService.reprocessDocument(id, userId);
    } catch (error) {
      this.logger.error(`[Controller] User ${userId} error reprocessing document ${id}: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(`重新处理文档失败: ${error.message}`);
    }
  }
  
  @Get(':id/status')
  @HttpCode(HttpStatus.OK) 
  async getDocumentStatus(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ): Promise<{ 
    id: string; 
    status: string | null; 
    statusMessage: string | null;
    filePath?: string | null;
    textContentExists: boolean;
    fileExists: boolean;
  }> {
    const userId = req.user.id;
    this.logger.log(`[Controller] User ${userId} request for document ${id} status`);
    
    try {
      const document = await this.documentsService.findOne(id, userId);
      if (!document) {
        throw new NotFoundException(`文档 ${id} 未找到`);
      }
      const fileExists = document.filePath ? fs.existsSync(document.filePath) : false;
      return {
        id: document.id,
        status: document.status,
        statusMessage: document.statusMessage,
        filePath: document.filePath,
        textContentExists: document.textContent != null && document.textContent.length > 0,
        fileExists: fileExists,
      };
    } catch (error) {
      this.logger.error(`[Controller] User ${userId} error getting document status for ${id}: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('获取文档状态失败.');
    }
  }

  @Post(':id/vector-data')
  @HttpCode(HttpStatus.OK)
  async saveVectorData(
    @Param('id') documentId: string,
    @Body() saveVectorDataDto: SaveVectorDataDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<{ message: string }> {
    const userId = req.user.id;
    this.logger.log(`User ${userId} request to save vector data for document ${documentId}`);
    try {
      const document = await this.documentsService.findOne(documentId, userId);
      if (!document) {
        throw new NotFoundException(`Document with ID ${documentId} not found or user does not have permission.`);
      }
      await this.documentsService.saveVectorData(documentId, userId, saveVectorDataDto.vectorData);
      return { message: 'Vector data saved successfully.' };
    } catch (error) {
      this.logger.error(`User ${userId} failed to save vector data for document ${documentId}: ${error.message}`, error.stack);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to save vector data.');
    }
  }

  @Get(':id/vector-data')
  @HttpCode(HttpStatus.OK)
  async getVectorData(
    @Param('id') documentId: string,
    @Request() req: AuthenticatedRequest,
  ): Promise<any | null> {
    const userId = req.user.id;
    this.logger.log(`User ${userId} request to get vector data for document ${documentId}`);
    try {
       const document = await this.documentsService.findOne(documentId, userId);
       if (!document) {
         throw new NotFoundException(`Document with ID ${documentId} not found or user does not have permission.`);
       }
      return await this.documentsService.getVectorData(documentId, userId);
    } catch (error) {
      this.logger.error(`User ${userId} failed to get vector data for document ${documentId}: ${error.message}`, error.stack);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to retrieve vector data.');
    }
  }
}

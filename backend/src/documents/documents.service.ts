import { Injectable, NotFoundException, InternalServerErrorException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Document, Prisma } from '@prisma/client';
// Try require syntax for pdf-parse
const pdfParse: (buffer: Buffer) => Promise<{ text: string; [key: string]: any; }> = require('pdf-parse');
// Import mammoth and officeparser
import * as mammoth from 'mammoth';
// 修改导入方式，使用require并添加类型断言
const officeparser = require('officeparser') as any;
// 注意：暂时不导入 DTO，因为 notebookId 会从请求的其他部分获取
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '@nestjs/config'; // To get upload path
import * as fsExtra from 'fs-extra'; // Import fs-extra
// 添加textract导入
const textract = require('textract');
const util = require('util');
// 创建异步版本的textract
const textractPromise = util.promisify(textract.fromBufferWithName);
// --- OCR Imports (New) ---
// Remove native tesseract import
// import * as tesseract from 'node-tesseract-ocr';
// Import Tesseract.js
import * as Tesseract from 'tesseract.js';
// Re-import pdf-img-convert
import * as pdf2img from 'pdf-img-convert';
// Remove or comment out node-poppler import
// const { Poppler } = require('node-poppler');
// Remove pdf-img-convert import
// import * as pdf2img from 'pdf-img-convert';
// ------------------------

@Injectable()
// No longer implements lifecycle interfaces
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);
  private readonly uploadsDir: string;
  private readonly VECTOR_DATA_FILENAME = 'vector_data.json'; // Constant for the filename
  private readonly MIN_TEXT_LENGTH_FOR_OCR = 100; // Threshold to trigger OCR

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    // @InjectQueue(DOCUMENT_PROCESSING_QUEUE) private documentQueue: Queue
    // private documentProcessorService: DocumentProcessorService, // Inject the service
  ) {
    const uploadsBasePath = this.configService.get<string>('UPLOADS_DIR') || 'uploads';
    this.uploadsDir = path.resolve(uploadsBasePath);
    this.logger.log(`Uploads directory resolved to: ${this.uploadsDir}`);
    fsExtra.ensureDirSync(this.uploadsDir); // Ensure base uploads directory exists
  }

  // Public getter for the upload path
  public get uploadPath(): string {
    return this.uploadsDir;
  }

  // --- create method (modified) ---
  async create(
    notebookId: string,
    file: Express.Multer.File,
    originalNameParam: string,
    initialStatus: string = 'PENDING',
    initialStatusMessage?: string,
  ): Promise<Document> {
    this.logger.log(`Starting document creation process for notebook ${notebookId}`);

    if (!file) {
        this.logger.error('File is missing in the request for document creation.');
        throw new BadRequestException('File data is missing.');
    }
    if (!notebookId) {
        this.logger.error('Notebook ID is missing for document creation.');
        throw new BadRequestException('Notebook ID is required.');
    }

    let docId: string | null = null;
    let finalFilePath: string | null = null;
    let createdDocument: Document | null = null;

    try {
      createdDocument = await this.prisma.$transaction(async (tx) => {
        const initialDocData = {
            fileName: `__temp__${uuidv4()}`,
            mimeType: file.mimetype,
          fileSize: file.size,
            status: 'PENDING',
            statusMessage: 'Determining final filename and saving...',
          notebook: {
            connect: { id: notebookId },
          },
        };

        const documentRecord = await (tx as any).document.create({ data: initialDocData });
        docId = documentRecord.id;
        if (!docId) {
             throw new Error('[Transaction] Failed to get document ID after creation.');
        }
        this.logger.verbose(`[Transaction] Document record created (TEMP): ID=${docId}`);

        // 2. Determine the final, non-conflicting filename and path
        const originalNameParamValue = originalNameParam; // Store param value for logging
        const originalNameFromFile = file.originalname; // Store file value for logging
        const originalName = originalNameParamValue || originalNameFromFile;
        this.logger.debug(`[Sanitize Debug] originalNameParam: ${originalNameParamValue}, file.originalname: ${originalNameFromFile}, used originalName: ${originalName}`);
        
        // --- ADD LOGS for basename and extname --- 
        let fileExt = '';
        let baseName = '';
        try {
            fileExt = path.extname(originalName);
            baseName = path.basename(originalName, fileExt);
            this.logger.debug(`[Sanitize Debug] path.extname result: ${fileExt}`);
            this.logger.debug(`[Sanitize Debug] path.basename result: ${baseName}`);
        } catch (pathError) {
             this.logger.error(`[Sanitize Debug] Error during path operations: ${pathError.message}`);
             // Fallback values if path operations fail
             fileExt = '.unknown';
             baseName = originalName.substring(0, originalName.length - fileExt.length) || 'document';
        }
        // --- END OF ADDED LOGS ---
        
        // FIX: Updated sanitization logic
        let sanitizedBaseName = baseName.replace(/[^\p{L}\p{N}_\-\.\s]/gu, '_');
        this.logger.debug(`[Sanitize Debug] After initial replace: ${sanitizedBaseName}`);
        sanitizedBaseName = sanitizedBaseName.replace(/\s+/g, '_');
        this.logger.debug(`[Sanitize Debug] After space replace: ${sanitizedBaseName}`);
        sanitizedBaseName = sanitizedBaseName.replace(/__+/g, '_');
        this.logger.debug(`[Sanitize Debug] After underscore merge: ${sanitizedBaseName}`);
        sanitizedBaseName = sanitizedBaseName.replace(/^[\s_]+|[\s_]+$/g, '') || 'document';
        this.logger.debug(`[Sanitize Debug] After trim: ${sanitizedBaseName}`);
        
        let fileNameToSave = '';
        finalFilePath = '';
        let counter = 0;
        let fileExists = true;
        const notebookUploadPath = path.join(this.uploadsDir, notebookId);
        const finalFileDir = path.join(notebookUploadPath, docId);
        
        await fsExtra.ensureDir(finalFileDir);
        this.logger.verbose(`[Transaction] Ensured directory exists: ${finalFileDir}`);

        while (fileExists) {
            if (counter === 0) {
                fileNameToSave = `${sanitizedBaseName}${fileExt}`;
            } else {
                fileNameToSave = `${sanitizedBaseName}(${counter})${fileExt}`;
            }
            
            // --- MODIFICATION START: Check DB for filename conflict --- 
            this.logger.verbose(`[Transaction] Checking DB for filename conflict: notebookId=${notebookId}, fileName=${fileNameToSave}`);
            const existingDoc = await (tx as any).document.findFirst({
                where: {
                    notebookId: notebookId,
                    fileName: fileNameToSave,
                    NOT: { id: docId } // Exclude the document currently being created
                },
                select: { id: true } // Only need to check existence
            });
            fileExists = !!existingDoc; // Set to true if a conflict is found
            // --- MODIFICATION END ---
            
            if (!fileExists) {
                this.logger.log(`[Transaction] Found non-conflicting DB filename: ${fileNameToSave}`);
                break;
            }
            
            this.logger.verbose(`[Transaction] Filename conflict found in DB for ${fileNameToSave}. Incrementing counter.`);
            counter++;
            if(counter > 100) { // Keep the safety break
                 this.logger.error(`[Transaction] Could not find a non-conflicting DB filename for ${originalName} after 100 attempts.`);
                 throw new Error('Failed to determine a unique database filename.');
            }
        }

        // Now that we have a unique DB filename, determine the final file path
        finalFilePath = path.join(finalFileDir, fileNameToSave);
        this.logger.log(`[Transaction] Determined final file path: ${finalFilePath}`);

        await fs.promises.writeFile(finalFilePath, file.buffer);
        this.logger.log(`[Transaction] Successfully saved uploaded file to: ${finalFilePath}`);

        const updatedDocument = await (tx as any).document.update({
            where: { id: docId },
            data: {
                fileName: fileNameToSave,
                filePath: finalFilePath,
                status: initialStatus,
                statusMessage: initialStatusMessage ?? 'File saved successfully',
            },
        });
        this.logger.verbose(`[Transaction] Updated document record ${docId} with final details.`);
        
        return updatedDocument;
      });
      
      this.logger.log(`Document created and file saved successfully: ID=${createdDocument?.id}`);

      if (createdDocument) { 
          try {
            await this.prisma.notebook.update({
              where: { id: notebookId },
              data: { updatedAt: new Date() },
            });
            this.logger.log(`Touched Notebook ${notebookId} updatedAt after creating document ${createdDocument.id}`);
            
            // 处理文档内容 (异步处理，不阻塞文档创建流程)
            this.processDocument(createdDocument.id).catch(error => {
              this.logger.error(`Failed to process document ${createdDocument!.id}: ${error.message}`, error.stack);
            });
            
          } catch (touchError) {
            this.logger.error(`Failed to touch Notebook ${notebookId} after creating document ${createdDocument.id}: ${touchError.message}`);
          }
      } else {
           this.logger.error('Transaction completed but createdDocument is null. Cannot touch parent notebook.');
      }

      return createdDocument!;

    } catch (error: any) {
        this.logger.error(`Error during document creation transaction for notebook ${notebookId}: ${error.message}`, error.stack);
        if (finalFilePath) { 
             try {
                 if (await fsExtra.pathExists(finalFilePath)) {
                     await fsExtra.remove(finalFilePath);
                     this.logger.warn(`Cleaned up file ${finalFilePath} after transaction error.`);
                     const docDir = path.dirname(finalFilePath);
                     try {
                         const files = await fs.promises.readdir(docDir);
                         if (files.length === 0) {
                              await fsExtra.rmdir(docDir);
                              this.logger.warn(`Removed empty directory ${docDir} after cleanup.`);
                         }
                     } catch (rmdirError) { /* Ignore error if dir removal fails */ }
                 }
             } catch (cleanupError) {
                 this.logger.error(`Failed to clean up file/dir ${finalFilePath} after error: ${cleanupError.message}`);
             }
        }
        throw new InternalServerErrorException(`Failed to create document: ${error.message}`);
    }
  }

  // --- Other methods remain the same ---
  async findAllByNotebook(notebookId: string): Promise<Document[]> {
    this.logger.log(`Finding documents for notebook ${notebookId}`);
    return this.prisma.document.findMany({
        where: { notebookId },
      orderBy: { createdAt: 'desc' },
      });
  }

  async findOne(id: string): Promise<Document | null> {
    this.logger.log(`Finding document with ID: ${id}`);
    const document = await this.prisma.document.findUnique({
      where: { id },
    });
    if (!document) {
      this.logger.warn(`Document with ID ${id} not found.`);
      throw new NotFoundException(`Document with ID ${id} not found`);
    }
    return document;
  }

  async getDocumentContent(id: string): Promise<string | Buffer | null> {
     this.logger.log(`[DocumentsService] Getting content for document ${id}`);
     const doc = await this.prisma.document.findUnique({
         where: { id },
         // Select both textContent and status
         select: { textContent: true, status: true, statusMessage: true, filePath: true }
     });

     if (!doc) {
         this.logger.warn(`[DocumentsService] Document ${id} not found`);
         return null; // Or throw NotFoundException
     }

     this.logger.log(`[DocumentsService] Document ${id} found with status: ${doc.status}, message: ${doc.statusMessage}`);
     
     // 转换状态为大写以便比较
     const status = doc.status?.toUpperCase() || '';
     
     // Check status before returning content
     if (status === 'FAILED') {
         this.logger.warn(`[DocumentsService] Document ${id} has failed status: ${doc.statusMessage}`);
         // Optionally throw an error or return a specific message
         throw new InternalServerErrorException(`文档处理失败: ${doc.statusMessage || '未知原因'}`);
     } else if (status !== 'COMPLETED') {
         this.logger.warn(`[DocumentsService] Document ${id} is not yet completed (status: ${status}).`);
         // Optionally throw an error or return a message indicating processing
         throw new InternalServerErrorException(`文档仍在处理中 (状态: ${status})`);
     }

     // 检查textContent是否存在
     if (!doc.textContent) {
         this.logger.warn(`[DocumentsService] Document ${id} has COMPLETED status but missing textContent`);
         
         // 检查文件是否存在
         if (doc.filePath && fs.existsSync(doc.filePath)) {
             this.logger.log(`[DocumentsService] Document ${id} has physical file at ${doc.filePath}, but no textContent in DB`);
             throw new InternalServerErrorException(`文档状态正常但内容未提取，请联系管理员`);
         } else {
             this.logger.error(`[DocumentsService] Document ${id} missing both textContent and physical file`);
             throw new InternalServerErrorException(`文档内容不可用，文件可能已被删除`);
         }
     }

     this.logger.log(`[DocumentsService] Successfully retrieved content for document ${id}`);
     // Only return content if status is completed
     return doc.textContent;
  }

   async remove(id: string): Promise<Document> {
    this.logger.log(`Attempting to delete document with ID: ${id}`);
    let documentToDelete: Document | null = null;
    let notebookId: string | null = null;

    try {
        documentToDelete = await this.prisma.document.findUnique({
            where: { id },
        });

        if (!documentToDelete) {
            this.logger.warn(`Document with ID ${id} not found for removal.`);
            throw new NotFoundException(`Document with ID ${id} not found.`);
        }
        notebookId = documentToDelete.notebookId;
        // FIX: Get the potential directory path using docId
        const docDirPath = documentToDelete.filePath ? path.dirname(documentToDelete.filePath) : null;
        // Check if the directory name is indeed the docId
        const docDirShouldBeId = docDirPath ? path.basename(docDirPath) === id : false;

        // 先删除向量数据
        if (notebookId) {
            try {
                await this.deleteVectorData(id, notebookId);
                this.logger.log(`Deleted vector data for document ${id}`);
            } catch (vectorDeleteError) {
                this.logger.error(`Failed to delete vector data for document ${id}: ${vectorDeleteError.message}`);
                // 继续处理，不中断删除流程
            }
        }

        const deletedDocumentRecord = await this.prisma.document.delete({ where: { id } });
        this.logger.log(`Successfully deleted document record for ID: ${id}`);

        if (notebookId) {
            try {
                await this.prisma.notebook.update({
                    where: { id: notebookId },
                    data: { updatedAt: new Date() },
                });
                this.logger.log(`Touched Notebook ${notebookId} updatedAt after removing document ${id}`);
            } catch (touchError) {
                this.logger.error(`Failed to touch Notebook ${notebookId} after removing document ${id}: ${touchError.message}`);
            }
        } else {
            this.logger.warn(`Could not touch parent notebook for removed document ${id} because notebookId was missing.`);
        }

        // FIX: Delete the entire directory <uploadsDir>/<notebookId>/<docId>
        if (docDirPath && docDirShouldBeId) {
             try {
                 if (await fsExtra.pathExists(docDirPath)) {
                     await fsExtra.remove(docDirPath); // Use remove to delete directory recursively
                     this.logger.log(`Successfully deleted document directory: ${docDirPath}`);
                 } else {
                      this.logger.warn(`Document directory ${docDirPath} recorded, but does not exist on filesystem for deleted document ${id}.`);
                 }
             } catch (fileError: any) {
                  this.logger.error(`Failed to delete document directory ${docDirPath} for deleted document ${id}: ${fileError.message}`, fileError.stack);
             }
        } else {
             const pathInfo = documentToDelete.filePath || '(no path recorded)';
             this.logger.warn(`Could not determine or verify document directory from path ${pathInfo} for deleted document ${id}. No directory cleanup performed.`);
        }

        return deletedDocumentRecord;

    } catch (error: any) {
        this.logger.error(`Error deleting document ${id}: ${error.message}`, error.stack);
        if (error instanceof NotFoundException) {
             throw error;
        }
        throw new InternalServerErrorException(`Could not delete document ${id}.`);
    }
  }

  // --- NEW METHOD TO GET FILE PATH ---
  async getDocumentFilePath(id: string): Promise<string> {
    this.logger.log(`Retrieving file path for document ID: ${id}`);
    const document = await this.prisma.document.findUnique({
      where: { id },
      select: { filePath: true }, // Only select the filePath
    });

    if (!document) {
      this.logger.warn(`Document with ID ${id} not found when retrieving file path.`);
      throw new NotFoundException(`Document with ID ${id} not found.`);
    }
    if (!document.filePath) {
      this.logger.error(`Document ${id} exists but does not have a filePath recorded.`);
      // Consider the document state? Maybe it's still processing?
      throw new InternalServerErrorException(`File path is missing for document ${id}.`);
    }

    this.logger.log(`Found file path for document ${id}: ${document.filePath}`);
    return document.filePath;
  }
  // --- END OF NEW METHOD --- 

  // Potential future methods:
  // async updateStatus(id: string, status: DocumentStatus): Promise<Document> { ... }
  // async addTextContent(id: string, content: string): Promise<Document> { ... }

  async delete(id: string): Promise<void> {
    this.logger.log(`Attempting to delete document with ID: ${id}`);
    // Use findUnique directly to potentially get filePath along with existence check
    const document = await this.prisma.document.findUnique({
      where: { id },
      select: { filePath: true } // Select filePath needed for file deletion
    });

    if (!document) {
      this.logger.warn(`Document with ID ${id} not found for deletion.`);
      throw new NotFoundException(`Document with ID ${id} not found.`);
    }

    // 1. Delete database record first
    try {
      await this.prisma.document.delete({
        where: { id },
      });
      this.logger.log(`Successfully deleted document record with ID: ${id} from database.`);
    } catch (error) {
      this.logger.error(`Failed to delete document record ${id} from database`, error.stack);
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
         // P2025 means record to delete not found, already handled by the initial check, but keep for robustness
         throw new NotFoundException(`Document with ID ${id} not found.`);
      }
      // Rethrow other DB errors to indicate the operation failed partially
      throw new InternalServerErrorException('Failed to delete document record.');
    }

    // 2. Delete file system file only after successful DB deletion
    // Ensure both document and filePath exist before trying to access/delete
    if (document && document.filePath) {
       const currentFilePath = document.filePath; // Use a variable to help TypeScript's flow analysis
       if (fs.existsSync(currentFilePath)) {
          try {
            fs.unlinkSync(currentFilePath); // Use the confirmed existing path
            this.logger.log(`Successfully deleted file: ${currentFilePath}`);
          } catch (error) {
            // Log error but don't throw; DB record is already gone.
            this.logger.error(`Failed to delete file ${currentFilePath} for document ${id}. The database record was deleted. Manual cleanup might be required.`, error.stack);
          }
       } else {
           this.logger.warn(`File path ${currentFilePath} recorded for document ${id}, but file does not exist on filesystem.`);
       }
    } else {
        // This handles both !document (shouldn't happen due to earlier check) and !document.filePath
        this.logger.warn(`No file path recorded or selected for deleted document ${id}. No file system cleanup performed.`);
    }
  }

  // 示例：处理 PDF 文件（如果需要）
  async processPdf(documentId: string): Promise<void> {
    // ... existing code ...
   }

  /**
   * 处理文档并提取文本内容
   * @param documentId 文档ID
   */
  async processDocument(documentId: string): Promise<void> {
    this.logger.log(`[ProcessDoc] Starting processing for document ID: ${documentId}`);
    const document = await this.prisma.document.findUnique({ where: { id: documentId } });

    if (!document || !document.filePath) {
      this.logger.error(`[ProcessDoc] Document or filePath not found for ID: ${documentId}`);
      await this.updateDocumentStatus(documentId, 'FAILED', '文件信息丢失');
      return;
    }

    const filePath = document.filePath;
    if (!fs.existsSync(filePath)) {
        this.logger.error(`[ProcessDoc] File does not exist at path: ${filePath} for document ${documentId}`);
        await this.updateDocumentStatus(documentId, 'FAILED', '文件不存在或已被删除');
        return;
    }
    const fileExt = path.extname(filePath).toLowerCase();
    this.logger.log(`[ProcessDoc] Processing file: ${filePath}, Extension: ${fileExt}`);

    try {
      await this.updateDocumentStatus(documentId, 'PROCESSING', '开始提取文本内容...');
      let textContent = '';

      switch (fileExt) {
        case '.pdf':
          this.logger.log(`[ProcessDoc] Extracting content from PDF: ${filePath}`);
          textContent = await this.extractPdfContent(filePath);
          break;
        case '.docx':
          this.logger.log(`[ProcessDoc] Extracting content from DOCX: ${filePath}`);
          textContent = await this.extractWordContent(filePath);
          break;
        case '.pptx':
           this.logger.log(`[ProcessDoc] Extracting content from PPTX: ${filePath}`);
           textContent = await this.extractPptContent(filePath);
           break;
        case '.txt':
        case '.md':
           this.logger.log(`[ProcessDoc] Extracting content from Text file: ${filePath}`);
           textContent = await this.extractTextFileContent(filePath);
           break;
        default:
          this.logger.warn(`[ProcessDoc] Unsupported file type: ${fileExt} for document ${documentId}`);
          await this.updateDocumentStatus(documentId, 'FAILED', `不支持的文件类型: ${fileExt}`);
          return;
      }

      this.logger.log(`[ProcessDoc] Successfully extracted content for document ${documentId}. Length: ${textContent?.length || 0}`);

      // Update document with extracted content and mark as completed
      await this.prisma.document.update({
        where: { id: documentId },
        data: {
          textContent: textContent || '', // Ensure textContent is never null
          status: 'COMPLETED',
          statusMessage: '文档处理完成',
        },
      });
      this.logger.log(`[ProcessDoc] Document ${documentId} marked as COMPLETED.`);
      
       // Touch the parent notebook's updatedAt timestamp
      if (document.notebookId) {
        await this.prisma.notebook.update({
          where: { id: document.notebookId },
          data: { updatedAt: new Date() },
        });
         this.logger.log(`[ProcessDoc] Touched Notebook ${document.notebookId} updatedAt.`);
      }

    } catch (error) {
      this.logger.error(`[ProcessDoc] Error processing document ${documentId} (${filePath}): ${error.message}`, error.stack);
      await this.updateDocumentStatus(documentId, 'FAILED', `处理失败: ${error.message}`);
    }
  }
  
  /**
   * 更新文档状态
   */
  private async updateDocumentStatus(documentId: string, status: string, statusMessage: string): Promise<void> {
    try {
      await this.prisma.document.update({
        where: { id: documentId },
        data: { status, statusMessage },
      });
      this.logger.log(`[StatusUpdate] Updated status for doc ${documentId}: ${status} - ${statusMessage}`);
    } catch (error) {
       // Log error if status update fails, but don't throw, as the underlying process might have still failed
       this.logger.error(`[StatusUpdate] Failed to update status for doc ${documentId}: ${error.message}`);
    }
  }
  
  /**
   * 提取PDF文件内容
   */
  private async extractPdfContent(filePath: string): Promise<string> {
    this.logger.log(`[PDF Extract] Starting standard text extraction for: ${filePath}`);
    let standardText = '';
    let extractionOk = false;
    try {
      const dataBuffer = await fs.promises.readFile(filePath);
      const pdfData = await pdfParse(dataBuffer);
      standardText = pdfData.text || '';
      extractionOk = true; // Mark as successful if pdfParse doesn't throw
      this.logger.log(`[PDF Extract] Standard extraction successful. Text length: ${standardText.length}`);
    } catch (error) {
      this.logger.error(`[PDF Extract] Standard PDF parsing failed for ${filePath}: ${error.message}`);
      // Explicitly set empty string on error
      standardText = '';
      // Do not re-throw, allow returning empty text
    }

    // Check if standard extraction yielded enough text
    if (extractionOk && standardText.length < this.MIN_TEXT_LENGTH_FOR_OCR) {
      // Log a warning if text is short, indicating OCR was skipped (as OCR logic is removed)
      this.logger.warn(`[PDF Extract] Standard text length (${standardText.length}) is below OCR threshold (${this.MIN_TEXT_LENGTH_FOR_OCR}). OCR step is skipped. Content might be incomplete.`);
    } else if (!extractionOk) {
        // Log if the initial parsing failed altogether
        this.logger.warn(`[PDF Extract] Standard text extraction failed. Returning empty content.`);
    }
    // Always return the result from pdf-parse (potentially empty or short)
    return standardText;
  }
  
  /**
   * 提取Word文档内容
   */
  private async extractWordContent(filePath: string): Promise<string> {
    this.logger.log(`[Word Extract] Starting content extraction for: ${filePath}`);
    try {
      const { value } = await mammoth.extractRawText({ path: filePath });
      this.logger.log(`[Word Extract] Extraction successful. Text length: ${value?.length || 0}`);
      return value || '';
    } catch (error) {
      this.logger.error(`[Word Extract] Failed to extract text from DOCX ${filePath}: ${error.message}`);
      throw new Error(`无法解析 DOCX 文件: ${error.message}`);
    }
  }
  
  /**
   * 提取PPT幻灯片内容
   */

  private async extractPptContent(filePath: string): Promise<string> {
     this.logger.warn(`[PPT Extract] Basic PPTX extraction for: ${filePath}. Note: This might miss speaker notes and complex elements.`);
     // Note: pptxgenjs is primarily for *creating* PPTX.
     // Actual text extraction from PPTX in Node.js is non-trivial and might require
     // external libraries or services (like Apache POI via a Java bridge, or specific parsing libs).
     // This is a VERY basic placeholder using known library limitations or requiring a different approach.

     // Placeholder: Attempt to read basic slide text if a suitable library was integrated.
     // For now, return empty as reliable extraction is complex.
     try {
         // Example (Conceptual - requires a suitable library like 'pptx-parser'):
         // const parser = require('pptx-parser'); // Assuming such a library exists and is installed
         // const presentation = await parser.parse(filePath);
         // let combinedText = '';
         // if (presentation && presentation.slides) {
         //     for (const slide of presentation.slides) {
         //         if (slide.text) combinedText += slide.text.join('\n') + '\n\n';
         //     }
         // }
         // this.logger.log(`[PPT Extract] Conceptual extraction length: ${combinedText.length}`);
         // return combinedText;

         this.logger.warn('[PPT Extract] Reliable PPTX text extraction is not implemented. Returning empty content.');
         return '';
     } catch (error) {
         this.logger.error(`[PPT Extract] Failed to extract text from PPTX ${filePath}: ${error.message}`);
         // Don't throw, just return empty for now, as it's not fully supported
         return '';
     }
  }
  /**
   * 提取普通文本文件内容
   */
  private async extractTextFileContent(filePath: string): Promise<string> {
    this.logger.log(`[Text Extract] Starting content extraction for: ${filePath}`);
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      this.logger.log(`[Text Extract] Extraction successful. Text length: ${content?.length || 0}`);
      return content || '';
    } catch (error) {
      this.logger.error(`[Text Extract] Failed to read text file ${filePath}: ${error.message}`);
      throw new Error(`无法读取文本文件: ${error.message}`);
    }
  }
  
  /**
   * 重新处理一个文档，用于手动触发文档内容提取
   */
  async reprocessDocument(documentId: string): Promise<Document> {
    this.logger.log(`[ReprocessDocument] Manually reprocessing document ${documentId}`);
    
    // 查找文档
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
    });
    
    if (!document) {
      this.logger.error(`[ReprocessDocument] Document ${documentId} not found`);
      throw new NotFoundException(`Document with ID ${documentId} not found`);
    }
    
    // 更新状态为PENDING
    await this.prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'PENDING',
        statusMessage: '文档重新处理中...',
      },
    });
    
    // 异步处理文档
    this.processDocument(documentId).catch(error => {
      this.logger.error(`[ReprocessDocument] Failed to reprocess document ${documentId}: ${error.message}`, error.stack);
    });
    
    return document;
  }

  // --- NEW VECTOR DATA METHODS ---

  /**
   * Saves vector data (e.g., DocumentChunk[]) associated with a document.
   * Overwrites existing data if the file already exists.
   * @param documentId The ID of the document.
   * @param vectorData The data to save (should be JSON-serializable).
   */
  async saveVectorData(documentId: string, vectorData: any): Promise<void> {
    this.logger.log(`Attempting to save vector data for document ID: ${documentId}`);
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: { notebookId: true, isVectorized: true }, // Need notebookId to construct the path and check vectorization status
    });

    if (!document) {
      this.logger.error(`Document with ID ${documentId} not found. Cannot save vector data.`);
      throw new NotFoundException(`Document with ID ${documentId} not found.`);
    }
    // Handle potential null notebookId if the document somehow lost its association
    if (!document.notebookId) {
        this.logger.error(`Document with ID ${documentId} has a null notebookId. Cannot determine path.`);
        throw new InternalServerErrorException(`Document ${documentId} is missing notebook association.`);
    }

    // 两个存储路径：
    // 1. 文档目录下的向量数据文件
    const documentVectorDataPath = path.join(this.uploadsDir, document.notebookId, documentId, this.VECTOR_DATA_FILENAME);
    const documentDir = path.dirname(documentVectorDataPath);

    // 2. 笔记本vectors目录下的向量数据文件
    const notebookVectorsDir = path.join(this.uploadsDir, document.notebookId, 'vectors');
    const notebookVectorDataPath = path.join(notebookVectorsDir, `${documentId}_vector_data.json`);
    
    try {
      // 确保目录存在
      await fsExtra.ensureDir(documentDir);
      await fsExtra.ensureDir(notebookVectorsDir);
      
      // 准备数据
      const jsonData = JSON.stringify(vectorData, null, 2); // Pretty print JSON
      
      // 同时保存到两个位置
      await fs.promises.writeFile(documentVectorDataPath, jsonData, 'utf-8');
      await fs.promises.writeFile(notebookVectorDataPath, jsonData, 'utf-8');
      
      // 更新文档的向量化状态标记
      if (!document.isVectorized) {
        await this.prisma.document.update({
          where: { id: documentId },
          data: { isVectorized: true }
        });
        this.logger.log(`Updated document ${documentId} isVectorized status to true`);
      }
      
      this.logger.log(`Successfully saved vector data to document path: ${documentVectorDataPath}`);
      this.logger.log(`Successfully saved vector data to notebook vectors path: ${notebookVectorDataPath}`);
    } catch (error: any) {
      this.logger.error(`Failed to save vector data for document ${documentId}: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Failed to save vector data: ${error.message}`);
    }
  }

  /**
   * Retrieves vector data associated with a document.
   * @param documentId The ID of the document.
   * @returns The parsed vector data, or null if the file doesn't exist.
   */
  async getVectorData(documentId: string): Promise<any | null> {
    this.logger.log(`Attempting to retrieve vector data for document ID: ${documentId}`);
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: { notebookId: true },
    });

    // If document record doesn't exist in DB, the vector data cannot exist either
    if (!document) {
      this.logger.warn(`Document record with ID ${documentId} not found when retrieving vector data.`);
      return null;
    }
     // Handle potential null notebookId
     if (!document.notebookId) {
         this.logger.warn(`Document with ID ${documentId} has a null notebookId. Cannot determine path for vector data.`);
         return null; // Treat as not found if path cannot be determined
     }

    // 尝试从两个位置获取
    const documentVectorDataPath = path.join(this.uploadsDir, document.notebookId, documentId, this.VECTOR_DATA_FILENAME);
    const notebookVectorDataPath = path.join(this.uploadsDir, document.notebookId, 'vectors', `${documentId}_vector_data.json`);

    try {
      let vectorData = null;
      
      // 首先检查笔记本vectors目录
      if (await fsExtra.pathExists(notebookVectorDataPath)) {
        this.logger.log(`Vector data found in notebook vectors directory: ${notebookVectorDataPath}`);
        const jsonData = await fs.promises.readFile(notebookVectorDataPath, 'utf-8');
        vectorData = JSON.parse(jsonData);
      } 
      // 如果没有，检查文档目录
      else if (await fsExtra.pathExists(documentVectorDataPath)) {
        this.logger.log(`Vector data found in document directory: ${documentVectorDataPath}`);
        const jsonData = await fs.promises.readFile(documentVectorDataPath, 'utf-8');
        vectorData = JSON.parse(jsonData);
      } else {
        this.logger.log(`Vector data not found for document ${documentId}`);
        return null;
      }
      
      this.logger.log(`Successfully retrieved and parsed vector data`);
      return vectorData;
    } catch (error: any) {
      // Handle JSON parsing errors specifically
      if (error instanceof SyntaxError) {
          this.logger.error(`Failed to parse vector data JSON for document ${documentId}: ${error.message}`);
          throw new InternalServerErrorException(`Failed to parse vector data for document ${documentId}: Corrupted file.`);
      }
       // Handle file not found errors gracefully (though pathExists should prevent this)
       if (error.code === 'ENOENT') {
           this.logger.warn(`Vector data file disappeared between existence check and read`);
           return null;
       }
      // For other errors (permissions, etc.), log and throw
      this.logger.error(`Failed to read or parse vector data for document ${documentId}: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Failed to retrieve vector data for document ${documentId}: ${error.message}`);
    }
  }
  
  /**
   * 删除与文档相关联的向量数据。
   * 在文档被删除时调用此方法。
   * @param documentId 文档ID
   * @param notebookId 笔记本ID
   */
  async deleteVectorData(documentId: string, notebookId: string): Promise<void> {
    this.logger.log(`Attempting to delete vector data for document ID: ${documentId}`);
    
    // 删除两个位置的向量数据
    const documentVectorDataPath = path.join(this.uploadsDir, notebookId, documentId, this.VECTOR_DATA_FILENAME);
    const notebookVectorDataPath = path.join(this.uploadsDir, notebookId, 'vectors', `${documentId}_vector_data.json`);
    
    try {
      // 删除文档目录下的向量数据
      if (await fsExtra.pathExists(documentVectorDataPath)) {
        await fs.promises.unlink(documentVectorDataPath);
        this.logger.log(`Deleted vector data from document directory: ${documentVectorDataPath}`);
      }
      
      // 删除笔记本vectors目录下的向量数据
      if (await fsExtra.pathExists(notebookVectorDataPath)) {
        await fs.promises.unlink(notebookVectorDataPath);
        this.logger.log(`Deleted vector data from notebook vectors directory: ${notebookVectorDataPath}`);
      }
    } catch (error: any) {
      this.logger.error(`Failed to delete vector data for document ${documentId}: ${error.message}`, error.stack);
      // 不抛出异常，因为这是清理操作，失败不应该中断主流程
    }
  }

}

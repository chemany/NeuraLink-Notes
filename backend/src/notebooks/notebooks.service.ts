import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; // Adjust path if needed
import { ConfigService } from '@nestjs/config';
import { Prisma, Notebook } from '@prisma/client'; // Import Notebook type and Prisma
import * as fsExtra from 'fs-extra';
import * as fs from 'fs/promises'; // Use promises API for fs
import * as path from 'path';
import { CreateNotebookDto } from './dto/create-notebook.dto'; // 导入 DTO

@Injectable()
export class NotebooksService {
  private readonly logger = new Logger(NotebooksService.name);
  private readonly uploadsDir: string;
  private readonly NOTES_FILENAME = 'notes.json'; // Constant for notes filename

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.uploadsDir = this.configService.get<string>('UPLOAD_PATH', 'uploads');
  }

  // 获取所有笔记本的方法
  async findAll(): Promise<Notebook[]> {
    this.logger.log('Fetching all notebooks');
    try {
      return await this.prisma.notebook.findMany({
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      this.logger.error(
        `Failed to fetch notebooks: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('获取笔记本列表失败');
    }
  }

  // 创建新笔记本的方法
  async create(createNotebookDto: CreateNotebookDto): Promise<Notebook> {
    this.logger.log(
      `Creating notebook: "${createNotebookDto.title}" ${createNotebookDto.folderId ? `in folder ${createNotebookDto.folderId}` : ''}`,
    );
    let newNotebook: Notebook | null = null; // Define here to access ID later
    try {
      const data: Prisma.NotebookCreateInput = {
        title: createNotebookDto.title,
      };
      if (createNotebookDto.folderId) {
        // Check if folder exists before associating
        const folderExists = await this.prisma.folder.findUnique({
          where: { id: createNotebookDto.folderId },
        });
        if (!folderExists) {
          throw new NotFoundException(
            `ID 为 ${createNotebookDto.folderId} 的文件夹不存在`,
          );
        }
        data.folder = { connect: { id: createNotebookDto.folderId } };
      }
      newNotebook = await this.prisma.notebook.create({ data });
      this.logger.log(
        `Successfully created notebook with ID: ${newNotebook.id}`,
      );

      // --- Ensure local directory exists after creation ---
      if (newNotebook) {
        const notebookDir = path.join(this.uploadsDir, newNotebook.id);
        try {
          await fsExtra.ensureDir(notebookDir);
          this.logger.log(
            `Ensured local directory exists for new notebook: ${notebookDir}`,
          );
        } catch (dirError: any) {
          this.logger.error(
            `Failed to create local directory ${notebookDir} for new notebook ${newNotebook.id}: ${dirError.message}`,
            dirError.stack,
          );
          // Log the error, but don't fail the notebook creation itself
        }
      }
      // --- End directory creation ---

      return newNotebook;
    } catch (error) {
      this.logger.error(
        `Failed to create notebook: ${error.message}`,
        error.stack,
      );
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('创建笔记本失败');
    }
  }

  async findOne(id: string): Promise<Notebook | null> {
    this.logger.log(`Fetching notebook with ID: ${id}`);
    try {
      const notebook = await this.prisma.notebook.findUnique({
        where: { id },
      });
      if (!notebook) {
        throw new NotFoundException(`找不到 ID 为 ${id} 的笔记本`);
      }
      return notebook;
    } catch (error) {
      this.logger.error(
        `Failed to fetch notebook ${id}: ${error.message}`,
        error.stack,
      );
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('获取笔记本详情失败');
    }
  }

  // Add the remove method here
  async remove(id: string): Promise<Notebook> {
    // Return the deleted notebook
    this.logger.log(`Attempting to delete notebook with ID: ${id}`);
    // Define the path *before* the transaction, in case DB delete fails but we still want to try cleanup
    const notebookUploadsPath = path.join(this.uploadsDir, id); // Use path.join

    try {
      // Use a transaction to ensure atomicity of DB operations
      const deletedNotebook = await this.prisma.$transaction(async (tx) => {
        // 1. Delete associated documents first
        const deletedDocs = await tx.document.deleteMany({
          where: { notebookId: id },
        });
        this.logger.log(
          `Deleted ${deletedDocs.count} documents associated with notebook ${id}.`,
        );

        // 2. Delete the notebook itself
        const notebook = await tx.notebook.delete({
          where: { id: id },
        });
        this.logger.log(`Deleted notebook record for ${id} from database.`);
        return notebook; // Return the deleted notebook data
      });

      // --- Modified File Deletion Logic ---
      // 3. If DB operations were successful, delete the uploads directory
      try {
        if (await fsExtra.pathExists(notebookUploadsPath)) {
          await fsExtra.remove(notebookUploadsPath); // Use fsExtra.remove for recursive deletion
          this.logger.log(`Deleted notebook directory: ${notebookUploadsPath}`);
        } else {
          this.logger.log(
            `Notebook directory not found, skipping deletion: ${notebookUploadsPath}`,
          );
        }
      } catch (fsError: any) {
        this.logger.error(
          `Failed to delete notebook directory ${notebookUploadsPath}: ${fsError.message}`,
          fsError.stack,
        );
        // Log the error, but don't fail the operation since DB record is gone
      }
      // --- End File Deletion Logic ---

      return deletedNotebook; // Return the notebook data that was deleted
    } catch (error) {
      // Handle specific Prisma error for record not found
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        this.logger.warn(`Notebook with ID ${id} not found for deletion.`);
        throw new NotFoundException(`找不到 ID 为 ${id} 的笔记本`);
      }
      // Handle other potential errors
      this.logger.error(
        `Error deleting notebook ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `删除笔记本时发生错误: ${error.message}`,
      );
    }
  }

  async update(
    id: string,
    updateData: { title?: string; folderId?: string | null; notes?: string },
  ): Promise<Notebook> {
    this.logger.log(`[NotebooksService] Updating notebook ${id} with data:`, {
      title: updateData.title,
      folderId: updateData.folderId,
      notesProvided: updateData.notes !== undefined,
    });

    // 检查笔记本是否存在
    const notebook = await this.prisma.notebook.findUnique({
      where: { id },
    });

    if (!notebook) {
      throw new NotFoundException(`笔记本 ID ${id} 不存在`);
    }

    // 如果提供了folderId，则检查文件夹是否存在
    if (updateData.folderId !== undefined) {
      if (updateData.folderId !== null) {
        const folder = await this.prisma.folder.findUnique({
          where: { id: updateData.folderId },
        });

        if (!folder) {
          throw new BadRequestException(
            `文件夹 ID ${updateData.folderId} 不存在`,
          );
        }
      }
    }

    // 准备要更新到数据库的数据 (排除 notes，如果它不存在于 DTO 中)
    const dbUpdateData: Prisma.NotebookUpdateInput = {};
    if (updateData.title !== undefined) dbUpdateData.title = updateData.title;
    if (updateData.folderId !== undefined) {
      if (updateData.folderId === null) {
        // Disconnect from folder
        dbUpdateData.folder = { disconnect: true };
      } else {
        // Connect to new folder
        dbUpdateData.folder = { connect: { id: updateData.folderId } };
      }
    }
    if (updateData.notes !== undefined) dbUpdateData.notes = updateData.notes;

    // --- 添加本地文件写入逻辑 ---
    let updatedNotebook: Notebook;
    try {
      // 1. 更新数据库
      updatedNotebook = await this.prisma.notebook.update({
        where: { id },
        data: dbUpdateData,
      });
      this.logger.log(`Successfully updated notebook ${id} in database.`);

      // 2. 如果 notes 被更新了，则写入本地文件
      if (updateData.notes !== undefined) {
        const notesFilePath = path.join(
          this.uploadsDir,
          id,
          this.NOTES_FILENAME,
        );
        const notesDir = path.dirname(notesFilePath);
        const notesJson = JSON.stringify({ notes: updateData.notes }, null, 2); // Format as JSON object
        try {
          await fsExtra.ensureDir(notesDir); // Ensure directory exists
          await fs.writeFile(notesFilePath, notesJson, 'utf-8');
          this.logger.log(
            `Successfully wrote notes to local file: ${notesFilePath}`,
          );
        } catch (fileError: any) {
          this.logger.error(
            `Failed to write notes to local file ${notesFilePath} for notebook ${id}: ${fileError.message}`,
            fileError.stack,
          );
          // 不抛出错误，因为数据库已更新，但记录严重错误
        }
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to update notebook ${id} in database: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(`更新笔记本 ${id} 失败`);
    }

    return updatedNotebook;
  }

  // 未来可以添加创建、查找单个、更新、删除等方法
  // create(data: { title: string }): Promise<Notebook> { ... }
  // findOne(id: string): Promise<Notebook | null> { ... }
  // update(id: string, data: { title?: string }): Promise<Notebook> { ... }
  // remove(id: string): Promise<Notebook> { ... }
}

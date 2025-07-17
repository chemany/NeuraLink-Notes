import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  Logger,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; // Adjust path if needed
import { ConfigService } from '@nestjs/config';
import { Prisma, Notebook } from '@prisma/client'; // Import Notebook type and Prisma
import * as fsExtra from 'fs-extra';
import * as fs from 'fs/promises'; // Use promises API for fs
import * as path from 'path';
import { CreateNotebookDto } from './dto/create-notebook.dto'; // 导入 DTO
import { UpdateNotebookDto } from './dto/update-notebook.dto'; // Assuming an UpdateNotebookDto exists or will be created

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

  /**
   * 根据用户ID获取用户名（通过邮箱映射）
   */
  private async getUsernameFromUserId(userId: string): Promise<string> {
    try {
      // 首先从数据库获取用户邮箱
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true }
      });

      if (!user || !user.email) {
        console.log(`[NotebooksService] 未找到用户ID ${userId} 对应的邮箱，使用用户ID`);
        return userId;
      }

      // 邮箱到用户名的映射
      const emailToUsername: Record<string, string> = {
        'link918@qq.com': 'jason'
        // 可以在这里添加更多映射
      };

      const username = emailToUsername[user.email] || user.email.split('@')[0];
      console.log(`[NotebooksService] 邮箱映射: ${user.email} -> ${username}`);
      return username;
    } catch (error) {
      console.error(`[NotebooksService] 获取用户名失败，使用用户ID:`, error);
      return userId;
    }
  }

  /**
   * 清理笔记本名称，使其适合作为文件夹名
   */
  private sanitizeNotebookName(title: string): string {
    const safeName = title
      .replace(/[<>:"/\\|?*]/g, '_')  // 替换Windows不允许的字符
      .replace(/\s+/g, '_')           // 替换空格为下划线
      .trim();

    console.log(`[NotebooksService] 笔记本名称清理: "${title}" -> "${safeName}"`);
    return safeName || 'untitled';
  }

  /**
   * 根据笔记本ID获取笔记本名称
   */
  private async getNotebookNameFromId(notebookId: string): Promise<string> {
    try {
      const notebook = await this.prisma.notebook.findUnique({
        where: { id: notebookId },
        select: { title: true }
      });

      if (!notebook || !notebook.title) {
        console.log(`[NotebooksService] 未找到笔记本ID ${notebookId} 对应的名称，使用笔记本ID`);
        return notebookId;
      }

      const safeName = this.sanitizeNotebookName(notebook.title);
      console.log(`[NotebooksService] 笔记本名称映射: ${notebookId} -> ${safeName}`);
      return safeName;
    } catch (error) {
      console.error(`[NotebooksService] 获取笔记本名称失败，使用笔记本ID:`, error);
      return notebookId;
    }
  }

  // 获取所有笔记本的方法
  async findAll(userId: string, folderId?: string | null): Promise<Notebook[]> {
    this.logger.log(`User ${userId} fetching notebooks. FolderId filter: ${folderId === undefined ? 'all' : (folderId === null ? 'root' : folderId)}`);
    try {
      const whereClause: Prisma.NotebookWhereInput = { userId };

      if (folderId !== undefined) { // folderId is explicitly passed
        whereClause.folderId = folderId; // Handles specific folderId or null for root
      }
      // If folderId is undefined, no folderId filter is applied, returning all user's notebooks.

      return await this.prisma.notebook.findMany({
        where: whereClause,
        orderBy: { updatedAt: 'desc' }, // Changed from createdAt to updatedAt for more relevant sorting
         include: { // Optionally include folder info
           folder: {
             select: {
               id: true,
               name: true,
             }
           }
         }
      });
    } catch (error) {
      this.logger.error(
        `User ${userId} failed to fetch notebooks (folderId: ${folderId}): ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('获取笔记本列表失败');
    }
  }

  // 创建新笔记本的方法
  async create(createNotebookDto: CreateNotebookDto, userId: string): Promise<Notebook> {
    this.logger.log(
      `User ${userId} creating notebook: "${createNotebookDto.title}" ${createNotebookDto.folderId ? `in folder ${createNotebookDto.folderId}` : ''}`,
    );
    let newNotebook: Notebook | null = null; // Define here to access ID later
    try {
      const data: Prisma.NotebookCreateInput = {
        title: createNotebookDto.title,
        user: { connect: { id: userId } }, // Connect to user
      };
      if (createNotebookDto.folderId) {
        const folder = await this.prisma.folder.findFirst({
          where: { id: createNotebookDto.folderId, userId }, // Ensure folder belongs to user
        });
        if (!folder) {
          throw new NotFoundException(
            `ID 为 ${createNotebookDto.folderId} 的文件夹不存在或不属于您。`,
          );
        }
        data.folder = { connect: { id: createNotebookDto.folderId } };
      }
      newNotebook = await this.prisma.notebook.create({ data });
      this.logger.log(
        `User ${userId} successfully created notebook with ID: ${newNotebook.id}`,
      );

      // --- Ensure local directory exists after creation ---
      if (newNotebook) {
        // 使用用户名和笔记本名称而不是随机ID来创建文件夹
        const username = await this.getUsernameFromUserId(userId);
        const notebookName = this.sanitizeNotebookName(newNotebook.title);
        const notebookDir = path.join(this.uploadsDir, username, notebookName);
        try {
          await fsExtra.ensureDir(notebookDir);
          this.logger.log(
            `Ensured local directory for new notebook: ${notebookDir}`,
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
        `User ${userId} failed to create notebook: ${error.message}`,
        error.stack,
      );
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('创建笔记本失败');
    }
  }

  async findOne(id: string, userId: string): Promise<Notebook | null> {
    this.logger.log(`User ${userId} fetching notebook with ID: ${id}`);
    try {
      const notebook = await this.prisma.notebook.findFirst({
        where: { id, userId }, // Ensure notebook belongs to user
      });
      if (!notebook) {
        throw new NotFoundException(`找不到 ID 为 ${id} 的笔记本或您没有权限访问。`);
      }
      return notebook;
    } catch (error) {
      this.logger.error(
        `User ${userId} failed to fetch notebook ${id}: ${error.message}`,
        error.stack,
      );
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('获取笔记本详情失败');
    }
  }

  // Add the remove method here
  async remove(id: string, userId: string): Promise<Notebook> {
    this.logger.log(`User ${userId} attempting to delete notebook with ID: ${id}`);
    const notebook = await this.findOne(id, userId); // Ensures notebook exists and belongs to user
    if (!notebook) { // findOne already throws if not found, but as a safeguard
      throw new NotFoundException(`找不到 ID 为 ${id} 的笔记本或您没有权限删除。`);
    }
    const notebookUploadsPath = path.join(this.uploadsDir, userId, id); // Add userId to path

    try {
      // Use a transaction to ensure atomicity of DB operations
      const deletedNotebook = await this.prisma.$transaction(async (tx) => {
        // 1. Delete associated documents first
        const deletedDocs = await tx.document.deleteMany({ where: { notebookId: id, userId } }); // Also ensure docs belong to user
        this.logger.log(
          `Deleted ${deletedDocs.count} documents associated with notebook ${id}.`,
        );

        // 2. Delete the notebook itself
        const nb = await tx.notebook.delete({ where: { id } }); // id is unique
        this.logger.log(`Deleted notebook record for ${id} from database.`);
        return nb; // Return the deleted notebook data
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
        `User ${userId} error deleting notebook ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `删除笔记本时发生错误: ${error.message}`,
      );
    }
  }

  async update(
    id: string,
    userId: string,
    updateDataDto: UpdateNotebookDto, // Use a DTO
    notesContent?: string, // Separate parameter for notes.json content if needed for file op
  ): Promise<Notebook> {
    this.logger.log(`User ${userId} updating notebook ${id}`);
    const notebook = await this.findOne(id, userId); // Ensures notebook exists and belongs to user
    if (!notebook) { // findOne should throw, but as a safeguard
      throw new NotFoundException(`笔记本 ID ${id} 不存在或不属于您`);
    }

    if (updateDataDto.folderId !== undefined) {
      if (updateDataDto.folderId !== null) {
        const folder = await this.prisma.folder.findFirst({
          where: { id: updateDataDto.folderId, userId }, // Ensure folder belongs to user
        });
        if (!folder) {
          throw new BadRequestException(
            `文件夹 ID ${updateDataDto.folderId} 不存在或不属于您。`,
          );
        }
      }
    }

    // 准备要更新到数据库的数据 (排除 notes，如果它不存在于 DTO 中)
    const dbUpdateData: Prisma.NotebookUpdateInput = {};
    if (updateDataDto.title !== undefined) dbUpdateData.title = updateDataDto.title;
    if (updateDataDto.folderId !== undefined) {
      dbUpdateData.folder = updateDataDto.folderId ? { connect: { id: updateDataDto.folderId } } : { disconnect: true };
    }
    // DO NOT update a 'notes' field in the database Notebook entity directly

    let updatedNotebook: Notebook;
    try {
      // 1. 更新数据库
      updatedNotebook = await this.prisma.notebook.update({
        where: { id }, // id is unique
        data: dbUpdateData,
      });
      this.logger.log(`User ${userId} successfully updated notebook ${id} in database.`);

      if (notesContent !== undefined) { // Check if notesContent was explicitly passed
        // 使用用户名和笔记本名称而不是随机ID来创建文件夹
        const username = await this.getUsernameFromUserId(userId);
        const notebookName = this.sanitizeNotebookName(updatedNotebook.title);
        const notebookDir = path.join(this.uploadsDir, username, notebookName);
        const notesFilePath = path.join(notebookDir, this.NOTES_FILENAME);
        try {
          await fsExtra.ensureDir(notebookDir);
          await fs.writeFile(notesFilePath, notesContent, 'utf-8');
          this.logger.log(
            `User ${userId} successfully wrote notes to ${notesFilePath} for notebook ${id}`,
          );
        } catch (fileError: any) {
          this.logger.error(
            `User ${userId} failed to write notes to ${notesFilePath} for notebook ${id}: ${fileError.message}`,
            fileError.stack,
          );
          // Decide if this should throw an error and rollback or just log
        }
      }
    } catch (error) {
      this.logger.error(
        `User ${userId} failed to update notebook ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('更新笔记本失败');
    }

    return updatedNotebook;
  }

  // Method to read notes.json from local filesystem for a specific notebook
  async getNotebookNotesFromFile(notebookId: string, userId: string): Promise<string | null> {
    await this.findOne(notebookId, userId); // Permission check

    // 使用用户名和笔记本名称构建路径
    const username = await this.getUsernameFromUserId(userId);
    const notebookName = await this.getNotebookNameFromId(notebookId);
    const notebookDir = path.join(this.uploadsDir, username, notebookName);
    const notesFilePath = path.join(notebookDir, this.NOTES_FILENAME);
    try {
      if (await fsExtra.pathExists(notesFilePath)) {
        const notes = await fs.readFile(notesFilePath, 'utf-8');
        this.logger.log(`User ${userId} successfully read notes from ${notesFilePath}`);
        return notes;
      }
      this.logger.log(`Notes file not found for notebook ${notebookId} (User ${userId}) at ${notesFilePath}`);
      return null; // Or throw NotFoundException, depending on desired behavior
    } catch (error: any) {
      this.logger.error(
        `User ${userId} failed to read notes from ${notesFilePath}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('读取笔记内容失败。');
    }
  }

  // 未来可以添加创建、查找单个、更新、删除等方法
  // create(data: { title: string }): Promise<Notebook> { ... }
  // findOne(id: string): Promise<Notebook | null> { ... }
  // update(id: string, data: { title?: string }): Promise<Notebook> { ... }
  // remove(id: string): Promise<Notebook> { ... }
}

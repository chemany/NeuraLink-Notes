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
    // 使用环境变量确定存储路径
    const storageType = this.configService.get<string>('STORAGE_TYPE') || 'local';
    const nasPath = this.configService.get<string>('NAS_PATH') || '/mnt/nas-sata12';

    console.log(`[NotebooksService] Storage configuration - STORAGE_TYPE: ${storageType}, NAS_PATH: ${nasPath}`);

    if (storageType === 'nas') {
      this.uploadsDir = path.join(nasPath, 'MindOcean', 'user-data', 'uploads');
    } else {
      this.uploadsDir = this.configService.get<string>('UPLOAD_PATH', 'uploads');
    }

    console.log(`[NotebooksService] Using uploads directory: ${this.uploadsDir}`);
  }

  /**
   * 根据用户ID获取用户邮箱
   */
  private async getUserEmailFromUserId(userId: string): Promise<string> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true }
      });
      return user?.email || `unknown-${userId}`;
    } catch (error) {
      console.error(`[NotebooksService] 获取用户邮箱失败:`, error);
      return `error-${userId}`;
    }
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
    // 获取用户名用于显示
    const username = await this.getUsernameFromUserId(userId);
    this.logger.log(`User ${username} (${userId}) fetching notebooks. FolderId filter: ${folderId === undefined ? 'all' : (folderId === null ? 'root' : folderId)}`);

    try {
      const whereClause: Prisma.NotebookWhereInput = { userId };

      if (folderId !== undefined) { // folderId is explicitly passed
        whereClause.folderId = folderId; // Handles specific folderId or null for root
      }
      // If folderId is undefined, no folderId filter is applied, returning all user's notebooks.

      const notebooks = await this.prisma.notebook.findMany({
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

      // 为每个笔记本添加可读的显示信息
      const notebooksWithDisplayInfo = notebooks.map(notebook => {
        const folderName = notebook.folder?.name || 'default';
        const displayPath = `${username}/${folderName}/${notebook.title}`;

        return {
          ...notebook,
          displayPath,
          ownerName: username,
          // 添加调试信息
          debugInfo: {
            id: notebook.id,
            userId: notebook.userId,
            username: username
          }
        };
      });

      this.logger.log(`User ${username} has ${notebooks.length} notebooks`);
      return notebooksWithDisplayInfo;
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

    // 检查同一文件夹内是否已存在同名笔记本
    const existingNotebook = await this.prisma.notebook.findFirst({
      where: {
        userId: userId,
        title: createNotebookDto.title.trim(),
        folderId: createNotebookDto.folderId || null, // null 表示根目录
      },
    });

    if (existingNotebook) {
      const folderName = createNotebookDto.folderId ? '指定文件夹' : '根目录';
      throw new BadRequestException(`${folderName}中已存在名为"${createNotebookDto.title.trim()}"的笔记本`);
    }

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
        // 使用用户名、文件夹名称和笔记本名称来创建文件夹结构
        const username = await this.getUsernameFromUserId(userId);
        const notebookName = this.sanitizeNotebookName(newNotebook.title);

        // 获取文件夹名称
        let folderName = 'default'; // 默认文件夹名称
        if (newNotebook.folderId) {
          const folder = await this.prisma.folder.findUnique({
            where: { id: newNotebook.folderId },
          });
          if (folder) {
            folderName = this.sanitizeNotebookName(folder.name);
          }
        }

        // 创建路径：uploads/用户名/文件夹名称/笔记本名称
        const notebookDir = path.join(this.uploadsDir, username, folderName, notebookName);
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
    // 获取用户名用于更直观的日志
    const username = await this.getUsernameFromUserId(userId);
    this.logger.log(`用户 ${username} 尝试删除笔记本 ID: ${id}`);

    try {
      // 首先获取笔记本信息，同时验证权限
      const notebook = await this.prisma.notebook.findFirst({
        where: { id, userId }, // 确保笔记本属于用户
        include: {
          folder: { select: { name: true } }
        }
      });

      if (!notebook) {
        // 调试：检查笔记本是否存在但属于其他用户
        const existingNotebook = await this.prisma.notebook.findUnique({
          where: { id },
          select: { id: true, title: true, userId: true, createdAt: true }
        });

        if (existingNotebook) {
          const notebookOwnerName = await this.getUsernameFromUserId(existingNotebook.userId);
          const currentUserEmail = await this.getUserEmailFromUserId(userId);
          const notebookOwnerEmail = await this.getUserEmailFromUserId(existingNotebook.userId);

          this.logger.warn(`❌ 权限错误 - 笔记本存在但属于其他用户:`);
          this.logger.warn(`   📝 笔记本: "${existingNotebook.title}"`);
          this.logger.warn(`   👤 实际所有者: ${notebookOwnerName} (${notebookOwnerEmail})`);
          this.logger.warn(`   🚫 当前用户: ${username} (${currentUserEmail})`);
          this.logger.warn(`   📅 创建时间: ${existingNotebook.createdAt}`);

        } else {
          this.logger.warn(`❌ 笔记本不存在: ID ${id}`);
        }

        throw new NotFoundException(`找不到笔记本或您没有权限删除。`);
      }

      const folderName = notebook.folder?.name || 'default';
      const displayPath = `${username}/${folderName}/${notebook.title}`;
      this.logger.log(`✅ 找到要删除的笔记本: ${displayPath}`);

      // 执行删除操作
      await this.performNotebookDeletion(id, userId, notebook);

      this.logger.log(`🗑️ 成功删除笔记本: ${displayPath}`);
      return notebook;

    } catch (error) {
      this.logger.error(`❌ 删除笔记本失败 (用户: ${username}, ID: ${id}):`, error.message);
      throw error;
    }
  }

  /**
   * 执行实际的笔记本删除操作
   */
  private async performNotebookDeletion(id: string, userId: string, notebook: Notebook): Promise<void> {
    // 使用用户名、文件夹名称和笔记本名称来构建删除路径，与创建时保持一致
    const username = await this.getUsernameFromUserId(userId);
    const notebookName = this.sanitizeNotebookName(notebook.title);

    // 获取文件夹名称
    let folderName = 'default'; // 默认文件夹名称
    if (notebook.folderId) {
      const folder = await this.prisma.folder.findUnique({
        where: { id: notebook.folderId },
      });
      if (folder) {
        folderName = this.sanitizeNotebookName(folder.name);
      }
    }

    // 构建路径：uploads/用户名/文件夹名称/笔记本名称
    const notebookUploadsPath = path.join(this.uploadsDir, username, folderName, notebookName);

    try {
      // Use a transaction to ensure atomicity of DB operations
      const deletedNotebook = await this.prisma.$transaction(async (tx) => {
        // 1. Delete associated documents first
        const deletedDocs = await tx.document.deleteMany({ where: { notebookId: id, userId } }); // Also ensure docs belong to user
        this.logger.log(
          `Deleted ${deletedDocs.count} documents associated with notebook ${id}.`,
        );

        // 2. Delete the notebook itself (we already verified it exists and belongs to user)
        const deletedNotebook = await tx.notebook.delete({ where: { id } });
        this.logger.log(`Deleted notebook record for ${id} from database.`);

        return deletedNotebook;
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

      // 删除操作成功完成
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

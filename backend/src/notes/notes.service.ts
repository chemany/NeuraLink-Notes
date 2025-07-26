import { Injectable, Logger, NotFoundException, InternalServerErrorException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; // 确保 PrismaService 已正确提供
import { Note, Prisma } from '@prisma/client'; // 从 @prisma/client 导入 Note 和 Prisma 类型
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs';
import * as fsExtra from 'fs-extra';

/**
 * Service responsible for business logic related to rich text Notes.
 * Interacts with the PrismaService to access the database.
 */
@Injectable()
export class NotesService {
  private readonly logger = new Logger(NotesService.name);
  private readonly uploadsDir: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    // 使用环境变量确定存储路径
    const storageType = this.configService.get<string>('STORAGE_TYPE') || 'local';
    const nasPath = this.configService.get<string>('NAS_PATH') || '/mnt/nas-sata12';

    if (storageType === 'nas') {
      this.uploadsDir = path.join(nasPath, 'MindOcean', 'user-data', 'uploads');
    } else {
      this.uploadsDir = this.configService.get<string>('UPLOAD_PATH', 'uploads');
    }
  }

  /**
   * 工具函数：将数据库 Note 对象的 contentJson 字段序列化为字符串，时间字段转为 ISO 字符串
   * @param note 数据库 Note 对象
   * @returns 处理后的 Note 对象
   */
  private serializeNote(note: Note): any {
    return {
      ...note,
      createdAt: note.createdAt instanceof Date ? note.createdAt.toISOString() : note.createdAt,
      updatedAt: note.updatedAt instanceof Date ? note.updatedAt.toISOString() : note.updatedAt,
      contentJson: note.contentJson ? JSON.stringify(note.contentJson) : null,
    };
  }

  /**
   * Creates a new rich text note within a specified notebook.
   * @param notebookId The ID of the notebook to create the note in.
   * @param userId The ID of the user creating the note.
   * @param createNoteDto DTO containing data for the new note.
   * @returns The created Note object.
   * @throws NotFoundException if the notebook does not exist or the user does not have permission.
   * @throws InternalServerErrorException if an unexpected error occurs.
   */
  async create(notebookId: string, userId: string, createNoteDto: CreateNoteDto): Promise<any> {
    this.logger.log(`User ${userId} attempting to create note in notebook ${notebookId}`);
    try {
      const notebook = await this.prisma.notebook.findFirst({
        where: { id: notebookId, userId }, // Ensure notebook belongs to user
      });
      if (!notebook) {
        this.logger.warn(`Notebook with ID ${notebookId} not found or not owned by user ${userId}.`);
        throw new NotFoundException(`Notebook with ID ${notebookId} not found or you don't have permission.`);
      }

      const dataToCreate: Prisma.NoteCreateInput = {
        title: createNoteDto.title,
        contentJson: createNoteDto.contentJson ? JSON.parse(createNoteDto.contentJson) : Prisma.JsonNull,
        contentHtml: createNoteDto.contentHtml,
        notebook: { connect: { id: notebookId } },
        user: { connect: { id: userId } }, // Connect to user
      };
      
      const newNote = await this.prisma.note.create({ data: dataToCreate });

      // 保存富文本笔记到文件系统
      try {
        await this.saveRichNoteAsFile(notebookId, userId, newNote.id, createNoteDto.title || '', createNoteDto.contentHtml || '');
      } catch (error) {
        this.logger.error(`Failed to save rich note ${newNote.id} to file system: ${error.message}`, error.stack);
      }

      this.logger.log(`User ${userId} successfully created note ID ${newNote.id} in notebook ${notebookId}`);
      return this.serializeNote(newNote);
    } catch (error) {
      this.logger.error(`User ${userId} failed to create note in notebook ${notebookId}: ${error.message}`, error.stack);
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to create note.');
    }
  }

  /**
   * Finds all rich text notes within a specified notebook.
   * @param notebookId The ID of the notebook.
   * @param userId The ID of the user accessing the notes.
   * @returns An array of Note objects.
   * @throws NotFoundException if the notebook does not exist or the user does not have permission.
   * @throws InternalServerErrorException if an unexpected error occurs.
   */
  async findAllByNotebook(notebookId: string, userId: string): Promise<any[]> {
    this.logger.log(`User ${userId} fetching all notes for notebook ID: ${notebookId}`);
    try {
      const notebook = await this.prisma.notebook.findFirst({
        where: { id: notebookId, userId }, // Ensure notebook belongs to user
      });
      if (!notebook) {
        this.logger.warn(`Notebook ${notebookId} not found or not owned by user ${userId} when fetching notes.`);
        throw new NotFoundException(`Notebook with ID ${notebookId} not found or you don't have permission.`);
      }
      
      const notes = await this.prisma.note.findMany({
        where: { notebookId: notebookId, userId: userId }, // Also filter notes by userId for explicit safety
        orderBy: { updatedAt: 'desc' },
      });
      this.logger.log(`User ${userId} found ${notes.length} notes for notebook ${notebookId}.`);
      return notes.map(this.serializeNote);
    } catch (error) {
      this.logger.error(`User ${userId} failed to fetch notes for notebook ${notebookId}: ${error.message}`, error.stack);
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to retrieve notes.');
    }
  }

  /**
   * Finds a specific rich text note by its ID.
   * @param noteId The ID of the note.
   * @param userId The ID of the user accessing the note.
   * @returns The Note object or null if not found.
   * @throws NotFoundException if the note does not exist or the user does not have permission.
   * @throws InternalServerErrorException if an unexpected error occurs.
   */
  async findOne(noteId: string, userId: string): Promise<any> {
    this.logger.log(`User ${userId} fetching note with ID: ${noteId}`);
    try {
      const note = await this.prisma.note.findFirst({
        where: { id: noteId, userId }, // Ensure note belongs to user
      });
      if (!note) {
        this.logger.warn(`Note with ID ${noteId} not found or not owned by user ${userId}.`);
        throw new NotFoundException(`Note with ID ${noteId} not found or you don't have permission.`);
      }
      return this.serializeNote(note);
    } catch (error) {
      this.logger.error(`User ${userId} failed to fetch note ${noteId}: ${error.message}`, error.stack);
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to retrieve note.');
    }
  }

  /**
   * Updates a specific rich text note.
   * @param noteId The ID of the note to update.
   * @param userId The ID of the user updating the note.
   * @param updateNoteDto DTO containing the fields to update.
   * @returns The updated Note object.
   * @throws NotFoundException if the note does not exist or the user does not have permission.
   * @throws InternalServerErrorException if an unexpected error occurs.
   */
  async update(noteId: string, userId: string, updateNoteDto: UpdateNoteDto): Promise<any> {
    this.logger.log(`User ${userId} attempting to update note ID: ${noteId}`);
    try {
      const existingNote = await this.findOne(noteId, userId); // findOne performs ownership check
      // existingNote will throw if not found or not owned, so we don't need to check ownership again here

      const dataToUpdate: Prisma.NoteUpdateInput = {};
      if (updateNoteDto.title !== undefined) dataToUpdate.title = updateNoteDto.title;
      if (updateNoteDto.contentJson !== undefined) {
        dataToUpdate.contentJson = updateNoteDto.contentJson ? JSON.parse(updateNoteDto.contentJson) : Prisma.JsonNull;
      }
      if (updateNoteDto.contentHtml !== undefined) dataToUpdate.contentHtml = updateNoteDto.contentHtml;
      dataToUpdate.updatedAt = new Date();

      const updatedNote = await this.prisma.note.update({
        where: { id: noteId }, // id is unique
        data: dataToUpdate,
      });

      // 更新文件系统中的富文本笔记
      if (updatedNote.notebookId) {
        try {
          // 如果标题发生了变化，需要先删除旧文件
          if (updateNoteDto.title !== undefined && updateNoteDto.title !== existingNote.title) {
            await this.deleteRichNoteFile(updatedNote.notebookId, userId, noteId, existingNote.title || '');
          }

          // 保存新文件（可能是新标题的文件名）
          await this.saveRichNoteAsFile(
            updatedNote.notebookId,
            userId,
            noteId,
            updateNoteDto.title || updatedNote.title || '',
            updateNoteDto.contentHtml || updatedNote.contentHtml || ''
          );
        } catch (error) {
          this.logger.error(`Failed to update rich note ${noteId} file: ${error.message}`, error.stack);
        }
      }

      this.logger.log(`User ${userId} successfully updated note ID: ${noteId}`);
      return this.serializeNote(updatedNote);
    } catch (error) {
      this.logger.error(`User ${userId} failed to update note ${noteId}: ${error.message}`, error.stack);
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        this.logger.warn(`Note with ID ${noteId} not found for update by user ${userId}.`);
        throw new NotFoundException(`Note with ID ${noteId} not found.`);
      }
      if (error instanceof ForbiddenException || error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to update note.');
    }
  }

  /**
   * Deletes a specific rich text note.
   * @param noteId The ID of the note to delete.
   * @param userId The ID of the user deleting the note.
   * @returns The deleted Note object.
   * @throws NotFoundException if the note does not exist or the user does not have permission.
   * @throws InternalServerErrorException if an unexpected error occurs.
   */
  async remove(noteId: string, userId: string): Promise<any> {
    this.logger.log(`User ${userId} attempting to delete note ID: ${noteId}`);
    try {
      const existingNote = await this.findOne(noteId, userId); // findOne performs ownership check
      // existingNote will throw if not found or not owned

      // 删除文件系统中的富文本笔记文件
      if (existingNote.notebookId) {
        try {
          await this.deleteRichNoteFile(existingNote.notebookId, userId, noteId, existingNote.title || '');
        } catch (error) {
          this.logger.error(`Failed to delete rich note ${noteId} file: ${error.message}`, error.stack);
        }
      }

      const deletedNote = await this.prisma.note.delete({
        where: { id: noteId }, // id is unique
      });
      this.logger.log(`User ${userId} successfully deleted note ID: ${noteId}`);
      return this.serializeNote(deletedNote);
    } catch (error) {
      this.logger.error(`User ${userId} failed to delete note ${noteId}: ${error.message}`, error.stack);
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        this.logger.warn(`Note ID ${noteId} not found for deletion by user ${userId}.`);
        throw new NotFoundException(`Note with ID ${noteId} not found.`);
      }
      if (error instanceof ForbiddenException || error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to delete note.');
    }
  }

  /**
   * 保存富文本笔记到文件系统
   */
  private async saveRichNoteAsFile(notebookId: string, userId: string, noteId: string, title: string, contentHtml: string) {
    try {
      // 使用用户名、文件夹名称和笔记本名称构建路径，与笔记本创建逻辑保持一致
      const username = await this.getUsernameFromUserId(userId);
      const { notebookName, folderName } = await this.getNotebookAndFolderNames(notebookId);
      const notebookDir = path.join(this.uploadsDir, username, folderName, notebookName);
      const richNotesDir = path.join(notebookDir, 'rich-notes');
      await fsExtra.ensureDir(richNotesDir);

      // 使用笔记标题作为主要文件名，noteId作为后缀以避免重复
      const safeTitle = this.sanitizeFileName(title) || 'untitled';
      const fileName = `${safeTitle}_${noteId}.html`;
      const filePath = path.join(richNotesDir, fileName);

      // 保存为HTML格式，包含标题
      const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
</head>
<body>
    <h1>${title}</h1>
    ${contentHtml}
</body>
</html>`;

      await fs.promises.writeFile(filePath, htmlContent, 'utf-8');
      this.logger.log(`User ${userId} successfully saved rich note ${noteId} as HTML file: ${filePath}`);

      return filePath;
    } catch (error) {
      this.logger.error(`User ${userId} failed to save rich note ${noteId} as HTML file: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * 删除富文本笔记文件
   */
  private async deleteRichNoteFile(notebookId: string, userId: string, noteId: string, title: string) {
    try {
      // 使用用户名、文件夹名称和笔记本名称构建路径，与创建逻辑保持一致
      const username = await this.getUsernameFromUserId(userId);
      const { notebookName, folderName } = await this.getNotebookAndFolderNames(notebookId);
      const notebookDir = path.join(this.uploadsDir, username, folderName, notebookName);
      const richNotesDir = path.join(notebookDir, 'rich-notes');

      if (!(await fsExtra.pathExists(richNotesDir))) {
        this.logger.warn(`Rich notes directory for notebook ${notebookId} (User ${userId}) does not exist, skipping file deletion`);
        return;
      }

      // 使用笔记标题作为主要文件名，noteId作为后缀
      const safeTitle = this.sanitizeFileName(title) || 'untitled';
      const fileName = `${safeTitle}_${noteId}.html`;
      const filePath = path.join(richNotesDir, fileName);

      if (await fsExtra.pathExists(filePath)) {
        await fs.promises.unlink(filePath);
        this.logger.log(`User ${userId} successfully deleted HTML file for rich note ${noteId}: ${filePath}`);
      } else {
        // 如果确切的文件名不存在，尝试查找以noteId开头的文件
        const files = await fs.promises.readdir(richNotesDir);
        const matchingFile = files.find(file => file.includes(`_${noteId}.html`));

        if (matchingFile) {
          const matchingFilePath = path.join(richNotesDir, matchingFile);
          await fs.promises.unlink(matchingFilePath);
          this.logger.log(`User ${userId} successfully deleted HTML file for rich note ${noteId}: ${matchingFilePath}`);
        } else {
          this.logger.warn(`No HTML file found for rich note ${noteId} (User ${userId}) in ${richNotesDir}`);
        }
      }
    } catch (error) {
      this.logger.error(`User ${userId} failed to delete HTML file for rich note ${noteId}: ${error.message}`, error.stack);
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
        console.log(`[NotesService] 未找到用户ID ${userId} 对应的邮箱，使用用户ID`);
        return userId;
      }

      // 邮箱到用户名的映射
      const emailToUsername: Record<string, string> = {
        'link918@qq.com': 'jason'
        // 可以在这里添加更多映射
      };

      const username = emailToUsername[user.email] || user.email.split('@')[0];
      console.log(`[NotesService] 邮箱映射: ${user.email} -> ${username}`);
      return username;
    } catch (error) {
      console.error(`[NotesService] 获取用户名失败，使用用户ID:`, error);
      return userId;
    }
  }

  /**
   * 根据笔记本ID获取笔记本名称和文件夹名称
   */
  private async getNotebookAndFolderNames(notebookId: string): Promise<{ notebookName: string; folderName: string }> {
    try {
      const notebook = await this.prisma.notebook.findUnique({
        where: { id: notebookId },
        select: {
          title: true,
          folderId: true,
          folder: {
            select: { name: true }
          }
        }
      });

      if (!notebook || !notebook.title) {
        console.log(`[NotesService] 未找到笔记本ID ${notebookId} 对应的信息，使用笔记本ID`);
        return { notebookName: notebookId, folderName: 'default' };
      }

      // 清理笔记本名称
      const notebookName = this.sanitizeFileName(notebook.title) || notebookId;

      // 获取文件夹名称
      let folderName = 'default';
      if (notebook.folderId && notebook.folder) {
        folderName = this.sanitizeFileName(notebook.folder.name) || 'default';
      }

      console.log(`[NotesService] 笔记本和文件夹映射: ${notebookId} -> ${folderName}/${notebookName}`);
      return { notebookName, folderName };
    } catch (error) {
      console.error(`[NotesService] 获取笔记本和文件夹信息失败，使用默认值:`, error);
      return { notebookName: notebookId, folderName: 'default' };
    }
  }

  /**
   * 根据笔记本ID获取笔记本名称（保留向后兼容性）
   */
  private async getNotebookNameFromId(notebookId: string): Promise<string> {
    const { notebookName } = await this.getNotebookAndFolderNames(notebookId);
    return notebookName;
  }

  /**
   * 清理文件名，使其适合作为文件名
   */
  private sanitizeFileName(title: string): string {
    const safeName = title
      .replace(/[<>:"/\\|?*]/g, '_')  // 替换Windows不允许的字符
      .replace(/\s+/g, '_')           // 替换空格为下划线
      .trim();

    return safeName || 'untitled';
  }
}
import { Injectable, NotFoundException, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNotePadNoteDto } from './dto/create-notepad-note.dto';
import { UpdateNotePadNoteDto } from './dto/update-notepad-note.dto';
import * as fs from 'fs/promises';
import * as fsExtra from 'fs-extra';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import { NotePadNote, Prisma } from '@prisma/client';

@Injectable()
export class NotePadService {
  private readonly logger = new Logger(NotePadService.name);
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

  async create(notebookId: string, userId: string, createNoteDto: CreateNotePadNoteDto): Promise<NotePadNote> {
    this.logger.log(`User ${userId} creating note in notebook ${notebookId}`);
    const note = await this.prisma.notePadNote.create({
      data: {
        ...createNoteDto,
        notebookId: notebookId,
        userId: userId,
      },
    });

    try {
      await this.prisma.notebook.update({
        where: { id: notebookId },
        data: { updatedAt: new Date() },
      });
      this.logger.log(`Touched Notebook ${notebookId} updatedAt after creating note ${note.id}`);
      
      await this.saveNoteAsMarkdownFile(notebookId, userId, note.id, createNoteDto.title || '', createNoteDto.content || '');
    } catch (error) {
      this.logger.error(`Failed after creating note ${note.id}: ${error.message}`, error.stack);
    }

    return note;
  }

  async findAllByNotebook(notebookId: string, userId: string): Promise<NotePadNote[]> {
    this.logger.log(`User ${userId} finding all notes for notebook ${notebookId}`);
    return this.prisma.notePadNote.findMany({
      where: { notebookId, userId },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  async findOne(id: string, userId: string): Promise<NotePadNote> {
    this.logger.log(`User ${userId} finding note with ID: ${id}`);
    const note = await this.prisma.notePadNote.findUnique({
      where: { id },
    });
    if (!note) {
      this.logger.warn(`NotePadNote with ID "${id}" not found`);
      throw new NotFoundException(`NotePadNote with ID "${id}" not found`);
    }
    if (note.userId !== userId) {
      this.logger.warn(`User ${userId} attempted to access note ${id} owned by ${note.userId}`);
      throw new ForbiddenException('您没有权限访问此笔记。');
    }
    return note;
  }

  async update(id: string, userId: string, updateNoteDto: UpdateNotePadNoteDto): Promise<NotePadNote> {
    this.logger.log(`User ${userId} updating note with ID: ${id}`);
    const existingNote = await this.findOne(id, userId);

    const updatedNote = await this.prisma.notePadNote.update({
      where: { id },
      data: updateNoteDto,
    });

    if (updatedNote.notebookId) {
      try {
        await this.prisma.notebook.update({
          where: { id: updatedNote.notebookId },
          data: { updatedAt: new Date() },
        });
        this.logger.log(`Touched Notebook ${updatedNote.notebookId} updatedAt after updating note ${id}`);
        
        await this.saveNoteAsMarkdownFile(
          updatedNote.notebookId, 
          userId,
          id, 
          updateNoteDto.title || updatedNote.title || '', 
          updateNoteDto.content || updatedNote.content || ''
        );
      } catch (error) {
        this.logger.error(`Failed after updating note ${id}: ${error.message}`, error.stack);
      }
    } else {
      this.logger.warn(`Could not touch parent notebook for updated note ${id} because notebookId was missing.`);
    }

    return updatedNote;
  }

  async remove(id: string, userId: string): Promise<NotePadNote> {
    this.logger.log(`User ${userId} removing note with ID: ${id}`);
    const noteToDelete = await this.findOne(id, userId);
    
    let notebookId: string | null = noteToDelete.notebookId;
    let noteTitle: string | null = noteToDelete.title;

    const deletedNote = await this.prisma.notePadNote.delete({
      where: { id },
    });

    if (notebookId) {
      try {
        await this.prisma.notebook.update({
          where: { id: notebookId },
          data: { updatedAt: new Date() },
        });
        this.logger.log(`Touched Notebook ${notebookId} updatedAt after removing note ${id}`);
        
        if (noteTitle) {
          await this.deleteNoteMarkdownFile(notebookId, userId, id, noteTitle);
        }
      } catch (error) {
        this.logger.error(`Failed after removing note ${id}: ${error.message}`, error.stack);
      }
    } else {
      this.logger.warn(`Could not touch parent notebook for removed note ${id} because notebookId was missing.`);
    }

    return deletedNote;
  }
  
  private async saveNoteAsMarkdownFile(notebookId: string, userId: string, noteId: string, title: string, content: string) {
    try {
      // 使用用户名、文件夹名称和笔记本名称构建路径，与笔记本创建逻辑保持一致
      const username = await this.getUsernameFromUserId(userId);
      const { notebookName, folderName } = await this.getNotebookAndFolderNames(notebookId);
      const notebookDir = path.join(this.uploadsDir, username, folderName, notebookName);
      const notesDir = path.join(notebookDir, 'notes');
      await fsExtra.ensureDir(notesDir);

      const fileName = `${noteId}_${this.sanitizeFileName(title)}.md`;
      const filePath = path.join(notesDir, fileName);
      
      const markdownContent = `# ${title}\n\n${content}`;
      
      await fs.writeFile(filePath, markdownContent, 'utf-8');
      this.logger.log(`User ${userId} successfully saved note ${noteId} as Markdown file: ${filePath}`);
      
      return filePath;
    } catch (error) {
      this.logger.error(`User ${userId} failed to save note ${noteId} as Markdown file: ${error.message}`, error.stack);
      return null;
    }
  }
  
  private async deleteNoteMarkdownFile(notebookId: string, userId: string, noteId: string, title: string) {
    try {
      // 使用用户名、文件夹名称和笔记本名称构建路径，与创建逻辑保持一致
      const username = await this.getUsernameFromUserId(userId);
      const { notebookName, folderName } = await this.getNotebookAndFolderNames(notebookId);
      const notebookDir = path.join(this.uploadsDir, username, folderName, notebookName);
      const notesDir = path.join(notebookDir, 'notes');

      if (!(await fsExtra.pathExists(notesDir))) {
        this.logger.warn(`Notes directory for notebook ${notebookId} (User ${userId}) does not exist, skipping file deletion`);
        return;
      }

      const fileName = `${noteId}_${this.sanitizeFileName(title)}.md`;
      const filePath = path.join(notesDir, fileName);
      
      if (await fsExtra.pathExists(filePath)) {
        await fs.unlink(filePath);
        this.logger.log(`User ${userId} successfully deleted Markdown file for note ${noteId}: ${filePath}`);
      } else {
        const files = await fs.readdir(notesDir);
        const matchingFile = files.find(file => file.startsWith(`${noteId}_`));
        
        if (matchingFile) {
          const matchingFilePath = path.join(notesDir, matchingFile);
          await fs.unlink(matchingFilePath);
          this.logger.log(`User ${userId} successfully deleted Markdown file for note ${noteId}: ${matchingFilePath}`);
        } else {
          this.logger.warn(`No Markdown file found for note ${noteId} (User ${userId}) in ${notesDir}`);
        }
      }
    } catch (error) {
      this.logger.error(`User ${userId} failed to delete Markdown file for note ${noteId}: ${error.message}`, error.stack);
    }
  }
  
  private sanitizeFileName(title: string): string {
    let safeTitle = title.replace(/[\\/:*?"<>|]/g, '');
    safeTitle = safeTitle.substring(0, 50);
    if (!safeTitle.trim()) {
      safeTitle = 'untitled';
    }
    return safeTitle;
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
        console.log(`[NotePadService] 未找到用户ID ${userId} 对应的邮箱，使用用户ID`);
        return userId;
      }

      // 邮箱到用户名的映射
      const emailToUsername: Record<string, string> = {
        'link918@qq.com': 'jason'
        // 可以在这里添加更多映射
      };

      const username = emailToUsername[user.email] || user.email.split('@')[0];
      console.log(`[NotePadService] 邮箱映射: ${user.email} -> ${username}`);
      return username;
    } catch (error) {
      console.error(`[NotePadService] 获取用户名失败，使用用户ID:`, error);
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
        console.log(`[NotePadService] 未找到笔记本ID ${notebookId} 对应的信息，使用笔记本ID`);
        return { notebookName: notebookId, folderName: 'default' };
      }

      // 清理笔记本名称
      const notebookName = this.sanitizeFileName(notebook.title) || notebookId;

      // 获取文件夹名称
      let folderName = 'default';
      if (notebook.folderId && notebook.folder) {
        folderName = this.sanitizeFileName(notebook.folder.name) || 'default';
      }

      console.log(`[NotePadService] 笔记本和文件夹映射: ${notebookId} -> ${folderName}/${notebookName}`);
      return { notebookName, folderName };
    } catch (error) {
      console.error(`[NotePadService] 获取笔记本和文件夹信息失败，使用默认值:`, error);
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
} 
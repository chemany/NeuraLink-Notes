import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNotePadNoteDto } from './dto/create-notepad-note.dto';
import { UpdateNotePadNoteDto } from './dto/update-notepad-note.dto';
import * as fs from 'fs/promises';
import * as fsExtra from 'fs-extra';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class NotePadService {
  private readonly logger = new Logger(NotePadService.name);
  private readonly uploadsDir: string;
  
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.uploadsDir = this.configService.get<string>('UPLOAD_PATH', 'uploads');
  }

  async create(notebookId: string, createNoteDto: CreateNotePadNoteDto) {
    this.logger.log(`Creating note in notebook ${notebookId}`);
    const note = await this.prisma.notePadNote.create({
      data: {
        ...createNoteDto,
        notebookId: notebookId,
      },
    });

    try {
      await this.prisma.notebook.update({
        where: { id: notebookId },
        data: { updatedAt: new Date() },
      });
      this.logger.log(`Touched Notebook ${notebookId} updatedAt after creating note ${note.id}`);
      
      // 保存为Markdown文件
      await this.saveNoteAsMarkdownFile(notebookId, note.id, createNoteDto.title || '', createNoteDto.content || '');
    } catch (error) {
      this.logger.error(`Failed after creating note ${note.id}: ${error.message}`, error.stack);
    }

    return note;
  }

  async findAllByNotebook(notebookId: string) {
    this.logger.log(`Finding all notes for notebook ${notebookId}`);
    return this.prisma.notePadNote.findMany({
      where: { notebookId },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    this.logger.log(`Finding note with ID: ${id}`);
    const note = await this.prisma.notePadNote.findUnique({
      where: { id },
    });
    if (!note) {
      this.logger.warn(`NotePadNote with ID "${id}" not found`);
      throw new NotFoundException(`NotePadNote with ID "${id}" not found`);
    }
    return note;
  }

  async update(id: string, updateNoteDto: UpdateNotePadNoteDto) {
    this.logger.log(`Updating note with ID: ${id}`);
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
        
        // 更新Markdown文件
        await this.saveNoteAsMarkdownFile(
          updatedNote.notebookId, 
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

  async remove(id: string) {
    this.logger.log(`Removing note with ID: ${id}`);
    let notebookId: string | null = null;
    let noteFileName: string | null = null;
    
    try {
      const noteToDelete = await this.prisma.notePadNote.findUnique({ 
        where: { id }, 
        select: { notebookId: true, title: true } 
      });
      notebookId = noteToDelete?.notebookId ?? null;
      noteFileName = noteToDelete?.title ? this.sanitizeFileName(noteToDelete.title) : null;
    } catch (findError) {
      this.logger.error(`Error finding note ${id} before removal: ${findError.message}`);
    }

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
        
        // 删除对应的Markdown文件
        if (noteFileName) {
          await this.deleteNoteMarkdownFile(notebookId, id, noteFileName);
        }
      } catch (error) {
        this.logger.error(`Failed after removing note ${id}: ${error.message}`, error.stack);
      }
    } else {
      this.logger.warn(`Could not touch parent notebook for removed note ${id} because notebookId was missing or could not be retrieved.`);
    }

    return deletedNote;
  }
  
  // 将笔记保存为Markdown文件
  private async saveNoteAsMarkdownFile(notebookId: string, noteId: string, title: string, content: string) {
    try {
      // 确保笔记本文件夹存在
      const notebookDir = path.join(this.uploadsDir, notebookId);
      const notesDir = path.join(notebookDir, 'notes');
      await fsExtra.ensureDir(notesDir);
      
      // 创建文件名（使用笔记ID和标题）
      const fileName = `${noteId}_${this.sanitizeFileName(title)}.md`;
      const filePath = path.join(notesDir, fileName);
      
      // 构建Markdown内容
      const markdownContent = `# ${title}\n\n${content}`;
      
      // 写入文件
      await fs.writeFile(filePath, markdownContent, 'utf-8');
      this.logger.log(`Successfully saved note ${noteId} as Markdown file: ${filePath}`);
      
      return filePath;
    } catch (error) {
      this.logger.error(`Failed to save note ${noteId} as Markdown file: ${error.message}`, error.stack);
      return null;
    }
  }
  
  // 删除笔记对应的Markdown文件
  private async deleteNoteMarkdownFile(notebookId: string, noteId: string, title: string) {
    try {
      const notebookDir = path.join(this.uploadsDir, notebookId);
      const notesDir = path.join(notebookDir, 'notes');
      
      // 检查目录是否存在
      if (!(await fsExtra.pathExists(notesDir))) {
        this.logger.warn(`Notes directory for notebook ${notebookId} does not exist, skipping file deletion`);
        return;
      }
      
      // 尝试删除使用ID和标题的文件
      const fileName = `${noteId}_${this.sanitizeFileName(title)}.md`;
      const filePath = path.join(notesDir, fileName);
      
      if (await fsExtra.pathExists(filePath)) {
        await fs.unlink(filePath);
        this.logger.log(`Successfully deleted Markdown file for note ${noteId}: ${filePath}`);
      } else {
        // 如果找不到确切的文件，尝试查找以noteId开头的任何文件
        const files = await fs.readdir(notesDir);
        const matchingFile = files.find(file => file.startsWith(`${noteId}_`));
        
        if (matchingFile) {
          const matchingFilePath = path.join(notesDir, matchingFile);
          await fs.unlink(matchingFilePath);
          this.logger.log(`Successfully deleted Markdown file for note ${noteId}: ${matchingFilePath}`);
        } else {
          this.logger.warn(`No Markdown file found for note ${noteId} in ${notesDir}`);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to delete Markdown file for note ${noteId}: ${error.message}`, error.stack);
    }
  }
  
  // 将标题转换为安全的文件名
  private sanitizeFileName(title: string): string {
    // 移除不允许在文件名中使用的字符
    let safeTitle = title.replace(/[\\/:*?"<>|]/g, '');
    // 限制长度
    safeTitle = safeTitle.substring(0, 50);
    // 如果为空，则使用默认名称
    if (!safeTitle.trim()) {
      safeTitle = 'untitled';
    }
    return safeTitle;
  }
} 
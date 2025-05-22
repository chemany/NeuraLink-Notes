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
    this.uploadsDir = this.configService.get<string>('UPLOAD_PATH', 'uploads');
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
      const notebookDir = path.join(this.uploadsDir, notebookId);
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
      const notebookDir = path.join(this.uploadsDir, notebookId);
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
} 
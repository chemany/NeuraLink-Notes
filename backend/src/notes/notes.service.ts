import { Injectable, Logger, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; // 确保 PrismaService 已正确提供
import { Note, Prisma } from '@prisma/client'; // 从 @prisma/client 导入 Note 和 Prisma 类型
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';

/**
 * Service responsible for business logic related to rich text Notes.
 * Interacts with the PrismaService to access the database.
 */
@Injectable()
export class NotesService {
  private readonly logger = new Logger(NotesService.name);

  constructor(private prisma: PrismaService) {}

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
   * @param createNoteDto DTO containing data for the new note.
   * @returns The created Note object.
   * @throws NotFoundException if the notebook does not exist.
   * @throws InternalServerErrorException if an unexpected error occurs.
   */
  async create(notebookId: string, createNoteDto: CreateNoteDto): Promise<any> {
    this.logger.log(`Attempting to create note in notebook ${notebookId} with title: ${createNoteDto.title}`);
    try {
      // 1. Check if the notebook exists
      const notebook = await this.prisma.notebook.findUnique({
        where: { id: notebookId },
      });
      if (!notebook) {
        this.logger.warn(`Notebook with ID ${notebookId} not found.`);
        throw new NotFoundException(`Notebook with ID ${notebookId} not found.`);
      }

      // 2. Prepare data for Prisma
      const dataToCreate: Prisma.NoteCreateInput = {
        title: createNoteDto.title,
        contentJson: createNoteDto.contentJson ? JSON.parse(createNoteDto.contentJson) : Prisma.JsonNull,
        contentHtml: createNoteDto.contentHtml,
        notebook: {
          connect: { id: notebookId },
        },
      };
      
      // 3. Create the note
      const newNote = await this.prisma.note.create({
        data: dataToCreate,
      });

      this.logger.log(`Successfully created note with ID ${newNote.id} in notebook ${notebookId}`);
      return this.serializeNote(newNote);
    } catch (error) {
      this.logger.error(`Failed to create note in notebook ${notebookId}: ${error.message}`, error.stack);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to create note.');
    }
  }

  /**
   * Finds all rich text notes within a specified notebook.
   * @param notebookId The ID of the notebook.
   * @returns An array of Note objects.
   * @throws NotFoundException if the notebook does not exist.
   * @throws InternalServerErrorException if an unexpected error occurs.
   */
  async findAllByNotebook(notebookId: string): Promise<any[]> {
    this.logger.log(`Fetching all notes for notebook ID: ${notebookId}`);
    try {
      const notebook = await this.prisma.notebook.findUnique({
        where: { id: notebookId },
        include: { richNotes: true }, // Ensure richNotes relation is loaded if needed elsewhere, or simply check existence
      });

      if (!notebook) {
        this.logger.warn(`Notebook with ID ${notebookId} not found when trying to fetch notes.`);
        throw new NotFoundException(`Notebook with ID ${notebookId} not found.`);
      }
      
      // Fetch notes specifically for this notebook
      const notes = await this.prisma.note.findMany({
        where: { notebookId: notebookId },
        orderBy: {
          updatedAt: 'desc', // Or createdAt, as per preference
        },
      });
      this.logger.log(`Found ${notes.length} notes for notebook ${notebookId}.`);
      return notes.map(this.serializeNote);
    } catch (error) {
      this.logger.error(`Failed to fetch notes for notebook ${notebookId}: ${error.message}`, error.stack);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to retrieve notes.');
    }
  }

  /**
   * Finds a specific rich text note by its ID.
   * @param noteId The ID of the note.
   * @returns The Note object or null if not found.
   * @throws NotFoundException if the note does not exist.
   * @throws InternalServerErrorException if an unexpected error occurs.
   */
  async findOne(noteId: string): Promise<any> {
    this.logger.log(`Fetching note with ID: ${noteId}`);
    try {
      const note = await this.prisma.note.findUnique({
        where: { id: noteId },
      });
      if (!note) {
        this.logger.warn(`Note with ID ${noteId} not found.`);
        throw new NotFoundException(`Note with ID ${noteId} not found.`);
      }
      return this.serializeNote(note);
    } catch (error) {
      this.logger.error(`Failed to fetch note ${noteId}: ${error.message}`, error.stack);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to retrieve note.');
    }
  }

  /**
   * Updates a specific rich text note.
   * @param noteId The ID of the note to update.
   * @param updateNoteDto DTO containing the fields to update.
   * @returns The updated Note object.
   * @throws NotFoundException if the note does not exist.
   * @throws InternalServerErrorException if an unexpected error occurs.
   */
  async update(noteId: string, updateNoteDto: UpdateNoteDto): Promise<any> {
    this.logger.log(`Attempting to update note ID: ${noteId}`);
    try {
      const dataToUpdate: Prisma.NoteUpdateInput = {};
      if (updateNoteDto.title !== undefined) {
        dataToUpdate.title = updateNoteDto.title;
      }
      if (updateNoteDto.contentJson !== undefined) {
        dataToUpdate.contentJson = updateNoteDto.contentJson ? JSON.parse(updateNoteDto.contentJson) : Prisma.JsonNull;
      }
      if (updateNoteDto.contentHtml !== undefined) {
        dataToUpdate.contentHtml = updateNoteDto.contentHtml;
      }
      
      // Ensure updatedAt is updated
      dataToUpdate.updatedAt = new Date();

      const updatedNote = await this.prisma.note.update({
        where: { id: noteId },
        data: dataToUpdate,
      });
      this.logger.log(`Successfully updated note ID: ${noteId}`);
      return this.serializeNote(updatedNote);
    } catch (error) {
      this.logger.error(`Failed to update note ${noteId}: ${error.message}`, error.stack);
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        // P2025: Record to update not found
        this.logger.warn(`Note with ID ${noteId} not found for update.`);
        throw new NotFoundException(`Note with ID ${noteId} not found.`);
      }
      throw new InternalServerErrorException('Failed to update note.');
    }
  }

  /**
   * Deletes a specific rich text note.
   * @param noteId The ID of the note to delete.
   * @returns The deleted Note object.
   * @throws NotFoundException if the note does not exist.
   * @throws InternalServerErrorException if an unexpected error occurs.
   */
  async remove(noteId: string): Promise<any> {
    this.logger.log(`Attempting to delete note ID: ${noteId}`);
    try {
      const deletedNote = await this.prisma.note.delete({
        where: { id: noteId },
      });
      this.logger.log(`Successfully deleted note ID: ${noteId}`);
      return this.serializeNote(deletedNote);
    } catch (error) {
      this.logger.error(`Failed to delete note ${noteId}: ${error.message}`, error.stack);
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        // P2025: Record to delete not found
        this.logger.warn(`Note with ID ${noteId} not found for deletion.`);
        throw new NotFoundException(`Note with ID ${noteId} not found.`);
      }
      throw new InternalServerErrorException('Failed to delete note.');
    }
  }
} 
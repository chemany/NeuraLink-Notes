import { Injectable, Logger, NotFoundException, InternalServerErrorException, ForbiddenException } from '@nestjs/common';
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
} 
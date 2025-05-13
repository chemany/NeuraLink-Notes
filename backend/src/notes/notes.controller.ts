import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  ValidationPipe,
} from '@nestjs/common';
import { NotesService } from './notes.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';

/**
 * 富文本笔记相关接口
 * 负责处理 /api/notebooks/:notebookId/richnotes 路由
 */
@Controller('notebooks/:notebookId/richnotes')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  /**
   * 获取指定笔记本下的所有富文本笔记
   * @param notebookId 笔记本ID
   */
  @Get()
  async findAll(@Param('notebookId') notebookId: string) {
    return this.notesService.findAllByNotebook(notebookId);
  }

  /**
   * 创建新的富文本笔记
   * @param notebookId 笔记本ID
   * @param createNoteDto 创建DTO
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('notebookId') notebookId: string,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    createNoteDto: CreateNoteDto,
  ) {
    return this.notesService.create(notebookId, createNoteDto);
  }

  /**
   * 获取单个富文本笔记
   * @param notebookId 笔记本ID
   * @param noteId 笔记ID
   */
  @Get(':noteId')
  async findOne(
    @Param('notebookId') notebookId: string,
    @Param('noteId') noteId: string,
  ) {
    return this.notesService.findOne(noteId);
  }

  /**
   * 更新富文本笔记
   * @param notebookId 笔记本ID
   * @param noteId 笔记ID
   * @param updateNoteDto 更新DTO
   */
  @Put(':noteId')
  async update(
    @Param('notebookId') notebookId: string,
    @Param('noteId') noteId: string,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    updateNoteDto: UpdateNoteDto,
  ) {
    return this.notesService.update(noteId, updateNoteDto);
  }

  /**
   * 删除富文本笔记
   * @param notebookId 笔记本ID
   * @param noteId 笔记ID
   */
  @Delete(':noteId')
  async remove(
    @Param('notebookId') notebookId: string,
    @Param('noteId') noteId: string,
  ) {
    return this.notesService.remove(noteId);
  }
}

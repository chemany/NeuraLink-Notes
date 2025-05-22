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
  UseGuards,
  Request,
} from '@nestjs/common';
import { NotesService } from './notes.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User as UserModel } from '@prisma/client';

interface AuthenticatedRequest extends Request {
  user: Omit<UserModel, 'password'> & { id: string };
}

/**
 * 富文本笔记相关接口
 * 负责处理 /api/notebooks/:notebookId/richnotes 路由
 */
@Controller('notebooks/:notebookId/richnotes')
@UseGuards(JwtAuthGuard)
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  /**
   * 获取指定笔记本下的所有富文本笔记
   * @param notebookId 笔记本ID
   */
  @Get()
  async findAll(@Param('notebookId') notebookId: string, @Request() req: AuthenticatedRequest) {
    const userId = req.user.id;
    return this.notesService.findAllByNotebook(notebookId, userId);
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
    @Body() createNoteDto: CreateNoteDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = req.user.id;
    return this.notesService.create(notebookId, userId, createNoteDto);
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
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = req.user.id;
    return this.notesService.findOne(noteId, userId);
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
    @Body() updateNoteDto: UpdateNoteDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = req.user.id;
    return this.notesService.update(noteId, userId, updateNoteDto);
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
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = req.user.id;
    return this.notesService.remove(noteId, userId);
  }
}

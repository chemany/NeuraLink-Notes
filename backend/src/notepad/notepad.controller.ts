import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
} from '@nestjs/common';
import { NotePadService } from './notepad.service';
import { CreateNotePadNoteDto } from './dto/create-notepad-note.dto';
import { UpdateNotePadNoteDto } from './dto/update-notepad-note.dto';
import { Logger } from '@nestjs/common';
import { UnifiedAuthGuard, AuthenticatedRequest } from '../unified-auth/unified-auth.guard';

@Controller('notebooks/:notebookId/notes')
@UseGuards(UnifiedAuthGuard)
export class NotePadController {
  private readonly logger = new Logger(NotePadController.name);

  constructor(private readonly notePadService: NotePadService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('notebookId') notebookId: string,
    @Body() createNoteDto: CreateNotePadNoteDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = req.user.id;
    this.logger.log(
      `[NotePadController] User ${userId} POST /notebooks/${notebookId}/notes`,
      JSON.stringify(createNoteDto),
    );
    return this.notePadService.create(notebookId, userId, createNoteDto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  findAllByNotebook(
    @Param('notebookId') notebookId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = req.user.id;
    this.logger.log(`[NotePadController] User ${userId} GET /notebooks/${notebookId}/notes`);
    return this.notePadService.findAllByNotebook(notebookId, userId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  findOne(
    @Param('notebookId') notebookId: string,
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = req.user.id;
    this.logger.log(
      `[NotePadController] User ${userId} GET /notebooks/${notebookId}/notes/${id}`,
    );
    return this.notePadService.findOne(id, userId);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  update(
    @Param('notebookId') notebookId: string,
    @Param('id') id: string,
    @Body() updateNoteDto: UpdateNotePadNoteDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = req.user.id;
    this.logger.log(
      `[NotePadController] User ${userId} PATCH /notebooks/${notebookId}/notes/${id}`,
      JSON.stringify(updateNoteDto),
    );
    return this.notePadService.update(id, userId, updateNoteDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(
    @Param('notebookId') notebookId: string,
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = req.user.id;
    this.logger.log(
      `[NotePadController] User ${userId} DELETE /notebooks/${notebookId}/notes/${id}`,
    );
    return this.notePadService.remove(id, userId);
  }
}

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
} from '@nestjs/common';
import { NotePadService } from './notepad.service';
import { CreateNotePadNoteDto } from './dto/create-notepad-note.dto';
import { UpdateNotePadNoteDto } from './dto/update-notepad-note.dto';
import { Logger } from '@nestjs/common';

// FIX: Use a consistent nested route structure
@Controller('notebooks/:notebookId/notes')
export class NotePadController {
  private readonly logger = new Logger(NotePadController.name);

  constructor(private readonly notePadService: NotePadService) {}

  // POST /notebooks/:notebookId/notes
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('notebookId') notebookId: string,
    @Body() createNoteDto: CreateNotePadNoteDto,
  ) {
    this.logger.log(
      `[NotePadController] POST /notebooks/${notebookId}/notes`,
      JSON.stringify(createNoteDto),
    );
    return this.notePadService.create(notebookId, createNoteDto);
  }

  // GET /notebooks/:notebookId/notes
  @Get()
  @HttpCode(HttpStatus.OK)
  findAllByNotebook(@Param('notebookId') notebookId: string) {
    this.logger.log(`[NotePadController] GET /notebooks/${notebookId}/notes`);
    return this.notePadService.findAllByNotebook(notebookId);
  }

  // GET /notebooks/:notebookId/notes/:id
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  findOne(@Param('notebookId') notebookId: string, @Param('id') id: string) {
    this.logger.log(
      `[NotePadController] GET /notebooks/${notebookId}/notes/${id}`,
    );
    return this.notePadService.findOne(id);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  update(
    @Param('notebookId') notebookId: string,
    @Param('id') id: string,
    @Body() updateNoteDto: UpdateNotePadNoteDto,
  ) {
    this.logger.log(
      `[NotePadController] PUT /notebooks/${notebookId}/notes/${id}`,
      JSON.stringify(updateNoteDto),
    );
    return this.notePadService.update(id, updateNoteDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('notebookId') notebookId: string, @Param('id') id: string) {
    this.logger.log(
      `[NotePadController] DELETE /notebooks/${notebookId}/notes/${id}`,
    );
    return this.notePadService.remove(id);
  }
}

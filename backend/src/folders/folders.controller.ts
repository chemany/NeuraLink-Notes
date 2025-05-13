import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FoldersService } from './folders.service';
import { CreateFolderDto } from './dto/create-folder.dto';

@Controller('folders')
export class FoldersController {
  constructor(private readonly foldersService: FoldersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createFolderDto: CreateFolderDto) {
    console.log(
      '[FoldersController] Received request for POST /folders, body:',
      createFolderDto,
    );
    return this.foldersService.create(createFolderDto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  findAll() {
    console.log('[FoldersController] Received request for GET /folders');
    return this.foldersService.findAll();
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  findOne(@Param('id') id: string) {
    console.log(`[FoldersController] Received request for GET /folders/${id}`);
    return this.foldersService.findOne(id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  update(@Param('id') id: string, @Body('name') name: string) {
    console.log(
      `[FoldersController] Received request for PATCH /folders/${id}, name: ${name}`,
    );
    return this.foldersService.update(id, name);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string) {
    console.log(
      `[FoldersController] Received request for DELETE /folders/${id}`,
    );
    return this.foldersService.remove(id);
  }
}

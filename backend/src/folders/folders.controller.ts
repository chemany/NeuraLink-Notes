import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  ValidationPipe,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FoldersService } from './folders.service';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
import { UnifiedAuthGuard, AuthenticatedRequest } from '../unified-auth/unified-auth.guard';
import { Folder } from '@prisma/client';

@Controller('folders')
@UseGuards(UnifiedAuthGuard)
export class FoldersController {
  private readonly logger = new Logger(FoldersController.name);

  constructor(private readonly foldersService: FoldersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    createFolderDto: CreateFolderDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<Folder> {
    const userId = req.user.id;
    this.logger.log(`[FoldersController] User ${userId} POST /folders`, createFolderDto);
    return this.foldersService.createFolder(userId, createFolderDto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(@Request() req: AuthenticatedRequest): Promise<Folder[]> {
    const userId = req.user.id;
    this.logger.log(`[FoldersController] User ${userId} GET /folders`);
    return this.foldersService.getFolders(userId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: AuthenticatedRequest): Promise<Folder> {
    const userId = req.user.id;
    this.logger.log(`[FoldersController] User ${userId} GET /folders/${id}`);
    return this.foldersService.getFolderById(userId, id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    updateFolderDto: UpdateFolderDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<Folder> {
    const userId = req.user.id;
    this.logger.log(`[FoldersController] User ${userId} PATCH /folders/${id}`, updateFolderDto);
    return this.foldersService.updateFolder(userId, id, updateFolderDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string, @Request() req: AuthenticatedRequest): Promise<Folder> {
    const userId = req.user.id;
    this.logger.log(`[FoldersController] User ${userId} DELETE /folders/${id}`);
    return this.foldersService.deleteFolder(userId, id);
  }
}

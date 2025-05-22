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
  UseGuards,
  Request,
  Put,
  Query,
  UsePipes,
  ValidationPipe,
  Req,
} from '@nestjs/common';
import { FoldersService } from './folders.service';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Folder, User } from '@prisma/client';

interface AuthenticatedRequest extends Request {
  user: Omit<User, 'password'> & { id: string };
}

@UseGuards(JwtAuthGuard)
@Controller('folders')
@UsePipes(new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
}))
export class FoldersController {
  constructor(private readonly foldersService: FoldersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createFolderDto: CreateFolderDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<Folder> {
    return this.foldersService.createFolder(req.user.id, createFolderDto);
  }

  @Get()
  async findAll(
    @Req() req: AuthenticatedRequest,
    @Query('parentId') parentId?: string,
  ): Promise<Folder[]> {
    return this.foldersService.getFolders(req.user.id, parentId);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<Folder> {
    return this.foldersService.getFolderById(req.user.id, id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateFolderDto: UpdateFolderDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<Folder> {
    return this.foldersService.updateFolder(req.user.id, id, updateFolderDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<Folder> {
    return this.foldersService.deleteFolder(req.user.id, id);
  }
}

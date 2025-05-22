import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Folder, Prisma } from '@prisma/client';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';

@Injectable()
export class FoldersService {
  constructor(private prisma: PrismaService) {}

  async create(createFolderDto: CreateFolderDto, userId: string): Promise<Folder> {
    return this.prisma.folder.create({
      data: {
        name: createFolderDto.name,
        userId: userId,
      },
    });
  }

  async findAll(userId: string): Promise<Folder[]> {
    return this.prisma.folder.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
  }

  async findOne(id: string, userId: string): Promise<Folder | null> {
    const folder = await this.prisma.folder.findFirst({
      where: { id, userId },
    });
    if (!folder) {
      throw new NotFoundException('文件夹未找到或您没有权限访问。');
    }
    return folder;
  }

  async update(id: string, updateFolderDto: UpdateFolderDto, userId: string): Promise<Folder> {
    const existingFolder = await this.prisma.folder.findFirst({
      where: { id, userId },
    });
    if (!existingFolder) {
      throw new NotFoundException('文件夹未找到或您没有权限更新。');
    }
    return this.prisma.folder.update({
      where: { id },
      data: {
        name: updateFolderDto.name,
      },
    });
  }

  async remove(id: string, userId: string): Promise<Folder> {
    const existingFolder = await this.prisma.folder.findFirst({
      where: { id, userId },
    });
    if (!existingFolder) {
      throw new NotFoundException('文件夹未找到或您没有权限删除。');
    }
    return this.prisma.folder.delete({ where: { id } });
  }
}

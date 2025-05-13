import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFolderDto } from './dto/create-folder.dto';

@Injectable()
export class FoldersService {
  constructor(private prisma: PrismaService) {}

  async create(createFolderDto: CreateFolderDto) {
    console.log('[FoldersService] Creating new folder:', createFolderDto);
    return this.prisma.folder.create({
      data: {
        name: createFolderDto.name,
      },
    });
  }

  async findAll() {
    console.log('[FoldersService] Finding all folders');
    return this.prisma.folder.findMany();
  }

  async findOne(id: string) {
    console.log(`[FoldersService] Finding folder with id: ${id}`);
    return this.prisma.folder.findUnique({
      where: { id },
    });
  }

  async update(id: string, name: string) {
    console.log(`[FoldersService] Updating folder ${id} with name: ${name}`);
    return this.prisma.folder.update({
      where: { id },
      data: { name },
    });
  }

  async remove(id: string) {
    console.log(`[FoldersService] Removing folder with id: ${id}`);
    // 首先将该文件夹下的所有笔记本移动到根目录
    await this.prisma.notebook.updateMany({
      where: { folderId: id },
      data: { folderId: null },
    });
    // 然后删除文件夹
    return this.prisma.folder.delete({
      where: { id },
    });
  }
}

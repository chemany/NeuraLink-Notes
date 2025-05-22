import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Folder, Prisma } from '@prisma/client';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';

@Injectable()
export class FoldersService {
  private readonly logger = new Logger(FoldersService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * 创建一个新的文件夹。
   * @param userId 用户ID
   * @param createFolderDto 包含文件夹名称和可选的父文件夹ID
   * @returns 创建的文件夹对象
   */
  async createFolder(userId: string, createFolderDto: CreateFolderDto): Promise<Folder> {
    this.logger.log(`User ${userId} creating folder with name "${createFolderDto.name}" and parentId "${createFolderDto.parentId}"`);
    const { name, parentId } = createFolderDto;

    const finalParentIdForQuery = parentId === undefined ? null : (parentId || null);

    // 检查同名文件夹是否已在同一父目录下存在
    const existingFolderWithSameName = await this.prisma.folder.findFirst({
      where: {
        userId,
        name,
        parentId: finalParentIdForQuery,
      },
    });

    if (existingFolderWithSameName) {
      this.logger.warn(`User ${userId} attempted to create a folder with a duplicate name "${name}" under parent "${parentId || 'root'}"`);
      throw new BadRequestException(`名为 "${name}" 的文件夹已在此位置存在。`);
    }

    if (parentId) {
      const parentFolder = await this.prisma.folder.findFirst({
        where: { id: parentId, userId },
      });
      if (!parentFolder) {
        this.logger.warn(`User ${userId} attempted to create a folder under a non-existent or unauthorized parent folder ${parentId}`);
        throw new BadRequestException('指定的父文件夹不存在或您没有权限访问。');
      }
    }

    try {
      const newFolder = await this.prisma.folder.create({
        data: {
          name,
          userId,
          parentId: finalParentIdForQuery,
        },
      });
      this.logger.log(`User ${userId} successfully created folder ${newFolder.id} with name "${newFolder.name}"`);
      return newFolder;
    } catch (error) {
      this.logger.error(`Error creating folder for user ${userId}: ${error.message}`, error.stack);
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // 例如，如果 parentId 格式错误或违反其他数据库约束
        throw new BadRequestException('创建文件夹失败，请检查输入数据。');
      }
      throw error; // Re-throw unexpected errors
    }
  }

  /**
   * 获取指定用户的文件夹列表。
   * @param userId 用户ID
   * @param parentId 可选的父文件夹ID。如果未提供，则返回根文件夹。
   * @returns 文件夹列表
   */
  async getFolders(userId: string, parentId?: string | null): Promise<Folder[]> {
    const effectiveParentId = parentId === undefined || parentId === '' ? null : parentId;
    this.logger.log(`User ${userId} fetching folders with parentId "${effectiveParentId === null ? 'root' : effectiveParentId}"`);
    
    return this.prisma.folder.findMany({
      where: {
        userId,
        parentId: effectiveParentId,
      },
      orderBy: { name: 'asc' }, // 按名称排序
      // 考虑是否要包含子文件夹数量或笔记本数量的计数
      // include: { _count: { select: { children: true, notebooks: true } } }
    });
  }

  /**
   * 根据ID获取特定文件夹的详细信息。
   * @param userId 用户ID
   * @param folderId 文件夹ID
   * @returns 文件夹对象，如果未找到则抛出 NotFoundException
   */
  async getFolderById(userId: string, folderId: string): Promise<Folder> {
    this.logger.log(`User ${userId} fetching folder with id "${folderId}"`);
    const folder = await this.prisma.folder.findFirst({
      where: { id: folderId, userId },
      // 考虑是否要包含子文件夹和笔记本
      // include: { children: true, notebooks: true }
    });

    if (!folder) {
      this.logger.warn(`Folder with id "${folderId}" not found for user ${userId}`);
      throw new NotFoundException('文件夹未找到或您没有权限访问。');
    }
    return folder;
  }

  /**
   * 更新文件夹。
   * @param userId 用户ID
   * @param folderId 要更新的文件夹ID
   * @param updateFolderDto 包含新的名称和/或新的父文件夹ID
   * @returns 更新后的文件夹对象
   */
  async updateFolder(userId: string, folderId: string, updateFolderDto: UpdateFolderDto): Promise<Folder> {
    this.logger.log(`User ${userId} updating folder ${folderId} with data: ${JSON.stringify(updateFolderDto)}`);
    const { name, newParentId } = updateFolderDto;

    if (!name && newParentId === undefined) {
      this.logger.warn(`User ${userId} called updateFolder for ${folderId} without providing any changes.`);
      throw new BadRequestException('没有提供要更新的文件夹信息。');
    }

    const folderToUpdate = await this.prisma.folder.findFirst({
      where: { id: folderId, userId },
    });

    if (!folderToUpdate) {
      this.logger.warn(`Folder ${folderId} not found for update by user ${userId}`);
      throw new NotFoundException('要更新的文件夹未找到或您没有权限。');
    }

    const parentIdForNameCheck = newParentId !== undefined ? 
                               (newParentId === null || newParentId === '' ? null : newParentId) 
                               : folderToUpdate.parentId;

    // 检查名称冲突 (如果名称改变了)
    if (name && name !== folderToUpdate.name) {
      const existingFolderWithSameName = await this.prisma.folder.findFirst({
        where: {
          userId,
          name,
          parentId: parentIdForNameCheck,
          NOT: { id: folderId }, // 排除自身
        },
      });
      if (existingFolderWithSameName) {
        this.logger.warn(`User ${userId} attempted to rename folder ${folderId} to a duplicate name "${name}"`);
        throw new BadRequestException(`名为 "${name}" 的文件夹已在目标位置存在。`);
      }
    }
    
    let parentIdForUpdate: string | null | undefined = undefined; // undefined 表示不改变 parentId

    if (newParentId !== undefined) { // newParentId 可能是 null, 空字符串, 或者一个ID
      if (newParentId === null || newParentId === '') { // 移动到根目录
        parentIdForUpdate = null;
      } else { // 移动到指定的父文件夹
        if (newParentId === folderId) {
          this.logger.warn(`User ${userId} attempted to move folder ${folderId} into itself.`);
          throw new BadRequestException('不能将文件夹移动到其自身内部。');
        }

        const targetParentFolder = await this.prisma.folder.findFirst({
          where: { id: newParentId, userId },
        });
        if (!targetParentFolder) {
          this.logger.warn(`User ${userId} attempted to move folder ${folderId} to a non-existent or unauthorized parent ${newParentId}`);
          throw new BadRequestException('指定的目标父文件夹不存在或您没有权限访问。');
        }
        
        // 防止循环移动：检查目标父文件夹是否是当前文件夹的子孙
        let currentAncestor = targetParentFolder;
        while (currentAncestor.parentId) {
          if (currentAncestor.parentId === folderId) {
            this.logger.warn(`User ${userId} attempted to create a circular dependency by moving ${folderId} into its descendant ${newParentId}`);
            throw new BadRequestException('不能将文件夹移动到其子文件夹下。');
          }
          const parent = await this.prisma.folder.findUnique({ where: { id: currentAncestor.parentId } });
          if (!parent) break; // Should not happen if data is consistent
          currentAncestor = parent;
        }
        parentIdForUpdate = newParentId;
      }
    }

    try {
      const dataToUpdate: Prisma.FolderUpdateInput = {};
      if (name) {
        dataToUpdate.name = name;
      }
      if (parentIdForUpdate !== undefined) { 
        if (parentIdForUpdate === null) {
          // 移动到根目录
          dataToUpdate.parent = {
            disconnect: true,
          };
        } else {
          // 移动到新的父文件夹
          dataToUpdate.parent = {
            connect: {
              id: parentIdForUpdate,
            },
          };
        }
      }

      if (Object.keys(dataToUpdate).length === 0) {
        this.logger.log(`No actual changes to apply for folder ${folderId} by user ${userId}. Returning current folder.`);
        return folderToUpdate; // 没有实际变化
      }
      
      const updatedFolder = await this.prisma.folder.update({
        where: { id: folderId },
        data: dataToUpdate,
      });
      this.logger.log(`User ${userId} successfully updated folder ${folderId}. New name: "${updatedFolder.name}", new parentId: "${updatedFolder.parentId}"`);
      return updatedFolder;
    } catch (error) {
      this.logger.error(`Error updating folder ${folderId} for user ${userId}: ${error.message}`, error.stack);
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
         throw new BadRequestException('更新文件夹失败，请检查输入数据。');
      }
      throw error;
    }
  }

  /**
   * 删除一个文件夹。
   * 其中的笔记本的 folderId 将被设为 null (移动到根目录)。
   * 子文件夹将被级联删除 (根据 schema 定义)。
   * @param userId 用户ID
   * @param folderId 要删除的文件夹ID
   * @returns 被删除的文件夹对象
   */
  async deleteFolder(userId: string, folderId: string): Promise<Folder> {
    this.logger.log(`User ${userId} attempting to delete folder ${folderId}`);

    const folderToDelete = await this.prisma.folder.findFirst({
      where: { id: folderId, userId },
      include: { 
        _count: {select: { notebooks: true, children: true } } // 用于日志记录
      }
    });

    if (!folderToDelete) {
      this.logger.warn(`Folder ${folderId} not found for deletion by user ${userId}`);
      throw new NotFoundException('要删除的文件夹未找到或您没有权限。');
    }

    // 新增检查：如果文件夹下有笔记本，则阻止删除
    if (folderToDelete._count.notebooks > 0) {
      this.logger.warn(`User ${userId} attempted to delete non-empty folder ${folderId} (contains notebooks).`);
      throw new BadRequestException('文件夹包含笔记本，无法删除。请先移动或删除其中的笔记本。');
    }

    this.logger.log(`Folder ${folderId} to be deleted by user ${userId} contains ${folderToDelete._count.notebooks} notebooks and ${folderToDelete._count.children} child folders (children will become root folders).`);

    // Prisma 的 onDelete: NoAction (对于父子文件夹中的 parent 关系) 和 默认的 SetNull (对于文件夹-笔记本，因 folderId 可选)
    // 会自动处理。我们只需要执行删除操作。
    // 子文件夹的 parentId 会被设为 null。
    // 笔记本的 folderId 会被设为 null。

    try {
      // 注意：Prisma 对于关系字段的 onDelete 行为是在数据库层面或 Prisma 引擎层面处理的。
      // 对于 SQLite，如果外键约束配置正确 (Prisma 会处理这个)，级联删除和 SetNull 应该能工作。
      // 我们在这里依赖 Prisma schema 中定义的 onDelete 行为。
      const deletedFolder = await this.prisma.folder.delete({
        where: { id: folderId },
      });
      this.logger.log(`User ${userId} successfully deleted folder ${folderId} (formerly "${deletedFolder.name}")`);
      return deletedFolder; // 返回的是删除前的数据
    } catch (error) {
      this.logger.error(`Error deleting folder ${folderId} for user ${userId}: ${error.message}`, error.stack);
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // P2025: Record to delete does not exist. (已被 NotFoundException 覆盖)
        // 其他可能的错误
        throw new InternalServerErrorException('删除文件夹时发生错误。');
      }
      throw error;
    }
  }
}

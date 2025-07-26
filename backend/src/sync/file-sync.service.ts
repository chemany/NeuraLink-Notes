import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { watch, FSWatcher } from 'chokidar';
import * as path from 'path';
import * as fs from 'fs';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FileSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FileSyncService.name);
  private watcher: FSWatcher | null = null;
  private uploadsDir: string;
  private syncInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    // 使用环境变量确定存储路径
    const storageType = this.configService.get<string>('STORAGE_TYPE') || 'local';
    const nasPath = this.configService.get<string>('NAS_PATH') || '/mnt/nas-sata12';

    if (storageType === 'nas') {
      this.uploadsDir = path.join(nasPath, 'MindOcean', 'user-data', 'uploads');
    } else {
      this.uploadsDir = this.configService.get<string>('UPLOADS_DIR') || 'uploads';
    }
  }

  /**
   * 根据邮箱获取实际的用户名（与NotebooksService保持一致）
   */
  private getUsernameFromEmail(email: string): string {
    // 邮箱到用户名的映射
    const emailToUsername: Record<string, string> = {
      'link918@qq.com': 'jason',
      'test@example.com': 'testuser',
      'test@test.com': 'testuser',
      'jason@qq.com': 'jason',
      'jplib@qq.com': 'jplib',
      'jplic@qq.com': 'jplic',
      'jpli@qq.com': 'jpli'
      // 可以在这里添加更多映射
    };

    return emailToUsername[email] || email.split('@')[0];
  }

  async onModuleInit() {
    this.logger.log('启动文件系统监控服务...');
    await this.startFileWatcher();
    await this.startPeriodicSync();
  }

  async onModuleDestroy() {
    this.logger.log('停止文件系统监控服务...');
    if (this.watcher) {
      await this.watcher.close();
    }
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
  }

  /**
   * 启动文件系统监控器
   */
  private async startFileWatcher() {
    try {
      // 监控uploads目录下的所有HTML文件
      const watchPath = path.join(this.uploadsDir, '**', 'rich-notes', '*.html');
      
      this.watcher = watch(watchPath, {
        ignored: /(^|[\/\\])\../, // 忽略隐藏文件
        persistent: true,
        ignoreInitial: true, // 忽略初始扫描
        awaitWriteFinish: {
          stabilityThreshold: 2000,
          pollInterval: 100
        }
      });

      this.watcher
        .on('unlink', (filePath) => {
          this.logger.log(`检测到文件删除: ${filePath}`);
          this.handleFileDeleted(filePath);
        })
        .on('add', (filePath) => {
          this.logger.log(`检测到文件添加: ${filePath}`);
          this.handleFileAdded(filePath);
        })
        .on('error', (error: Error) => {
          this.logger.error(`文件监控错误: ${error.message}`, error.stack);
        });

      this.logger.log(`文件系统监控已启动，监控路径: ${watchPath}`);
    } catch (error) {
      this.logger.error(`启动文件监控失败: ${error.message}`, error.stack);
    }
  }

  /**
   * 启动定期同步任务
   */
  private async startPeriodicSync() {
    // 每5分钟执行一次完整同步检查
    this.syncInterval = setInterval(async () => {
      this.logger.log('执行定期同步检查...');
      await this.performFullSync();
    }, 5 * 60 * 1000);

    // 启动时执行一次完整同步
    setTimeout(async () => {
      await this.performFullSync();
    }, 10000); // 延迟10秒启动，确保系统完全启动
  }

  /**
   * 处理文件删除事件
   */
  private async handleFileDeleted(filePath: string) {
    try {
      // 从文件路径提取noteId
      const fileName = path.basename(filePath, '.html');
      const noteIdMatch = fileName.match(/_([a-f0-9-]{36})$/);
      
      if (!noteIdMatch) {
        this.logger.warn(`无法从文件名提取noteId: ${fileName}`);
        return;
      }

      const noteId = noteIdMatch[1];
      
      // 检查数据库中是否存在该笔记
      const note = await this.prisma.note.findUnique({
        where: { id: noteId }
      });

      if (note) {
        // 删除数据库记录
        await this.prisma.note.delete({
          where: { id: noteId }
        });
        this.logger.log(`已删除孤立的笔记记录: ${noteId}`);
        
        // 这里可以发送WebSocket通知前端更新
        // await this.notifyFrontend('note-deleted', { noteId, notebookId: note.notebookId });
      }
    } catch (error) {
      this.logger.error(`处理文件删除事件失败: ${error.message}`, error.stack);
    }
  }

  /**
   * 处理文件添加事件
   */
  private async handleFileAdded(filePath: string) {
    try {
      // 从文件路径提取信息
      const fileName = path.basename(filePath, '.html');
      const noteIdMatch = fileName.match(/_([a-f0-9-]{36})$/);
      
      if (!noteIdMatch) {
        this.logger.warn(`无法从文件名提取noteId: ${fileName}`);
        return;
      }

      const noteId = noteIdMatch[1];
      
      // 检查数据库中是否已存在该笔记
      const existingNote = await this.prisma.note.findUnique({
        where: { id: noteId }
      });

      if (!existingNote) {
        this.logger.log(`发现新文件但数据库中无对应记录: ${noteId}`);
        // 这里可以尝试从文件内容创建数据库记录，或者只是记录日志
      }
    } catch (error) {
      this.logger.error(`处理文件添加事件失败: ${error.message}`, error.stack);
    }
  }

  /**
   * 执行完整同步检查
   */
  private async performFullSync() {
    try {
      this.logger.log('开始执行完整同步检查...');

      let cleanedNotesCount = 0;
      let cleanedNotebooksCount = 0;

      // 1. 检查并清理孤立的笔记记录
      const allNotes = await this.prisma.note.findMany({
        include: { notebook: true }
      });

      for (const note of allNotes) {
        if (!note.notebookId || !note.notebook) {
          continue;
        }

        try {
          // 构建文件路径
          const user = await this.prisma.user.findUnique({
            where: { id: note.userId }
          });

          if (!user) continue;

          // 使用与笔记本同步相同的用户名映射逻辑
          const actualUsername = this.getUsernameFromEmail(user.email);
          const notebookDir = path.join(this.uploadsDir, actualUsername, note.notebook.title);
          const richNotesDir = path.join(notebookDir, 'rich-notes');
          const safeTitle = this.sanitizeFileName(note.title || '') || 'untitled';
          const fileName = `${safeTitle}_${note.id}.html`;
          const filePath = path.join(richNotesDir, fileName);

          this.logger.log(`检查富文本笔记: ${note.title} (${note.id})`);
          this.logger.log(`  用户邮箱: ${user.email}, 实际用户名: ${actualUsername}`);
          this.logger.log(`  文件路径: ${filePath}, 存在: ${fs.existsSync(filePath)}`);

          // 检查文件是否存在
          if (!fs.existsSync(filePath)) {
            // 文件不存在，删除数据库记录
            await this.prisma.note.delete({
              where: { id: note.id }
            });
            cleanedNotesCount++;
            this.logger.log(`🗑️  清理孤立笔记记录: ${note.title} (${note.id}) - 文件不存在: ${filePath}`);
          } else {
            this.logger.log(`✅ 富文本笔记文件存在，跳过清理: ${note.title}`);
          }
        } catch (error) {
          this.logger.error(`检查笔记 ${note.id} 时出错: ${error.message}`);
        }
      }

      // 2. 检查并清理孤立的笔记本记录
      const allNotebooks = await this.prisma.notebook.findMany({
        include: { user: true }
      });

      for (const notebook of allNotebooks) {
        if (!notebook.user) continue;

        try {
          // 使用与NotebooksService相同的用户名映射逻辑
          const actualUsername = this.getUsernameFromEmail(notebook.user.email);
          const userDir = path.join(this.uploadsDir, actualUsername);
          const notebookDir = path.join(userDir, notebook.title);

          this.logger.log(`检查笔记本: ${notebook.title}, 用户邮箱: ${notebook.user.email}`);
          this.logger.log(`数据库用户名: ${notebook.user.username}, 实际用户名: ${actualUsername}`);
          this.logger.log(`用户目录: ${userDir}, 存在: ${fs.existsSync(userDir)}`);
          this.logger.log(`笔记本目录: ${notebookDir}, 存在: ${fs.existsSync(notebookDir)}`);

          // 检查用户目录是否存在
          if (!fs.existsSync(userDir)) {
            this.logger.log(`用户目录不存在，清理用户 ${actualUsername} 的所有数据`);
            await this.cleanupUserData(notebook.userId);
            cleanedNotebooksCount++;
            continue;
          }

          // 检查笔记本目录是否存在
          if (!fs.existsSync(notebookDir)) {
            // 笔记本目录不存在，删除笔记本及其相关数据
            this.logger.log(`准备清理孤立笔记本: ${notebook.title} (目录不存在: ${notebookDir})`);
            await this.cleanupNotebookData(notebook.id);
            cleanedNotebooksCount++;
            this.logger.log(`已清理孤立笔记本记录: ${notebook.title}`);
          } else {
            this.logger.log(`笔记本 ${notebook.title} 目录存在，跳过清理`);
          }
        } catch (error) {
          this.logger.error(`检查笔记本 ${notebook.id} 时出错: ${error.message}`);
        }
      }

      if (cleanedNotesCount > 0 || cleanedNotebooksCount > 0) {
        this.logger.log(`完整同步检查完成，清理了 ${cleanedNotesCount} 个孤立笔记记录，${cleanedNotebooksCount} 个孤立笔记本记录`);
      } else {
        this.logger.log('完整同步检查完成，未发现孤立记录');
      }
    } catch (error) {
      this.logger.error(`完整同步检查失败: ${error.message}`, error.stack);
    }
  }

  /**
   * 清理文件名中的非法字符
   */
  private sanitizeFileName(fileName: string): string {
    return fileName.replace(/[<>:"/\\|?*]/g, '_').trim();
  }

  /**
   * 清理用户的所有数据
   */
  private async cleanupUserData(userId: string): Promise<void> {
    try {
      // 删除用户的所有笔记
      await this.prisma.note.deleteMany({
        where: { userId }
      });

      // 删除用户的所有文档
      await this.prisma.document.deleteMany({
        where: { userId }
      });

      // 删除用户的所有笔记本
      await this.prisma.notebook.deleteMany({
        where: { userId }
      });

      // 删除用户的所有文件夹
      await this.prisma.folder.deleteMany({
        where: { userId }
      });

      this.logger.log(`已清理用户 ${userId} 的所有数据`);
    } catch (error) {
      this.logger.error(`清理用户 ${userId} 数据失败: ${error.message}`, error.stack);
    }
  }

  /**
   * 清理笔记本的所有数据
   */
  private async cleanupNotebookData(notebookId: string): Promise<void> {
    try {
      this.logger.log(`开始清理笔记本 ${notebookId} 的数据...`);

      // 统计要删除的数据
      const notesCount = await this.prisma.note.count({ where: { notebookId } });
      const documentsCount = await this.prisma.document.count({ where: { notebookId } });

      this.logger.log(`笔记本 ${notebookId} 包含: ${notesCount} 个笔记, ${documentsCount} 个文档`);

      // 删除笔记本的所有笔记
      const deletedNotes = await this.prisma.note.deleteMany({
        where: { notebookId }
      });
      this.logger.log(`删除了 ${deletedNotes.count} 个笔记`);

      // 删除笔记本的所有文档
      const deletedDocuments = await this.prisma.document.deleteMany({
        where: { notebookId }
      });
      this.logger.log(`删除了 ${deletedDocuments.count} 个文档`);

      // 删除笔记本记录
      await this.prisma.notebook.delete({
        where: { id: notebookId }
      });
      this.logger.log(`删除了笔记本记录 ${notebookId}`);

      this.logger.log(`已完成清理笔记本 ${notebookId} 的所有数据`);
    } catch (error) {
      this.logger.error(`清理笔记本 ${notebookId} 数据失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 根据用户名清理用户数据
   */
  async cleanupUserByUsername(username: string): Promise<{ cleaned: number; message: string }> {
    this.logger.log(`开始清理用户 ${username} 的数据...`);

    try {
      // 查找用户
      const user = await this.prisma.user.findUnique({
        where: { username }
      });

      if (!user) {
        return {
          cleaned: 0,
          message: `用户 ${username} 不存在`
        };
      }

      // 统计要清理的数据
      const notesCount = await this.prisma.note.count({ where: { userId: user.id } });
      const notebooksCount = await this.prisma.notebook.count({ where: { userId: user.id } });
      const documentsCount = await this.prisma.document.count({ where: { userId: user.id } });
      const foldersCount = await this.prisma.folder.count({ where: { userId: user.id } });

      // 清理用户数据
      await this.cleanupUserData(user.id);

      const totalCleaned = notesCount + notebooksCount + documentsCount + foldersCount;

      return {
        cleaned: totalCleaned,
        message: `成功清理用户 ${username} 的数据：${notesCount} 个笔记，${notebooksCount} 个笔记本，${documentsCount} 个文档，${foldersCount} 个文件夹`
      };
    } catch (error) {
      this.logger.error(`清理用户 ${username} 数据失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 手动触发完整同步（供API调用）
   */
  async triggerFullSync(): Promise<{ cleaned: number; message: string }> {
    this.logger.log('手动触发完整同步...');

    const beforeNotesCount = await this.prisma.note.count();
    const beforeNotebooksCount = await this.prisma.notebook.count();

    await this.performFullSync();

    const afterNotesCount = await this.prisma.note.count();
    const afterNotebooksCount = await this.prisma.notebook.count();

    const cleanedNotes = beforeNotesCount - afterNotesCount;
    const cleanedNotebooks = beforeNotebooksCount - afterNotebooksCount;
    const totalCleaned = cleanedNotes + cleanedNotebooks;

    return {
      cleaned: totalCleaned,
      message: totalCleaned > 0
        ? `手动同步完成，清理了 ${cleanedNotes} 个孤立笔记记录，${cleanedNotebooks} 个孤立笔记本记录`
        : '手动同步完成，未发现孤立记录'
    };
  }
}

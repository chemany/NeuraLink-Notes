import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service'; // Adjust path if needed
import * as archiver from 'archiver';
import * as fsExtra from 'fs-extra';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import * as AdmZip from 'adm-zip';
import { Prisma, Folder, NotePadNote } from '@prisma/client'; // 添加NotePadNote导入

interface NotebookBackupData {
  id: string;
  notesJsonString: string;
}

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly uploadsDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    // Assuming UPLOAD_PATH is configured in .env or config module
    this.uploadsDir = this.configService.get<string>('UPLOAD_PATH', 'uploads'); 
    this.logger.log(`Uploads directory set to: ${this.uploadsDir}`);
  }

  async createBackupZip(notebookData: NotebookBackupData[]): Promise<NodeJS.ReadableStream> {
    this.logger.log(`Starting backup creation for ${notebookData.length} notebooks.`);

    // 1. Create a unique temporary directory for this backup
    const tempBackupDir = path.join(os.tmpdir(), `notebook-backup-${crypto.randomBytes(8).toString('hex')}`);
    try {
      await fsExtra.ensureDir(tempBackupDir);
      this.logger.log(`Created temporary backup directory: ${tempBackupDir}`);

      // 2. Prepare manifest file (optional but good practice)
      const manifest = {
        backupVersion: '1.0',
        createdAt: new Date().toISOString(),
        notebookCount: notebookData.length,
        notebooks: notebookData.map(nb => nb.id),
      };
      await fsExtra.writeJson(path.join(tempBackupDir, 'backup_manifest.json'), manifest, { spaces: 2 });

      // 2.1 Backup all folders
      const folders = await this.prisma.folder.findMany();
      if (folders.length > 0) {
        this.logger.log(`Backing up ${folders.length} folders`);
        await fsExtra.writeJson(path.join(tempBackupDir, 'folders.json'), folders, { spaces: 2 });
      }

      // 3. Process each notebook
      for (const nb of notebookData) {
        this.logger.log(`Processing notebook ID: ${nb.id}`);
        const notebookDir = path.join(tempBackupDir, nb.id);
        await fsExtra.ensureDir(notebookDir);

        // 3a. Save notes data
        await fsExtra.writeFile(path.join(notebookDir, 'notes.json'), nb.notesJsonString);

        // 3a.1 保存笔记元数据
        const notePadNotes = await this.prisma.notePadNote.findMany({
          where: { notebookId: nb.id },
        });
        if (notePadNotes.length > 0) {
          this.logger.log(`Backing up ${notePadNotes.length} notepad notes for notebook ${nb.id}`);
          await fsExtra.writeJson(path.join(notebookDir, 'notepad_notes.json'), notePadNotes, { spaces: 2 });
        }

        // 3b. Fetch and save notebook metadata
        const notebookMeta = await this.prisma.notebook.findUnique({
          where: { id: nb.id },
        });
        if (!notebookMeta) {
          this.logger.warn(`Notebook metadata not found for ID: ${nb.id}, skipping metadata.`);
        } else {
          await fsExtra.writeJson(path.join(notebookDir, 'metadata.json'), notebookMeta, { spaces: 2 });
        }

        // 3c. Fetch document metadata
        const documents = await this.prisma.document.findMany({
          where: { notebookId: nb.id },
        });
        await fsExtra.writeJson(path.join(notebookDir, 'documents_meta.json'), documents, { spaces: 2 });

        // 3d. Copy original document files and notes markdown files
        const notebookUploadsDir = path.resolve(this.uploadsDir, nb.id);
        const backupDocsDir = path.join(notebookDir, 'documents');
        const notesMarkdownDir = path.join(notebookUploadsDir, 'notes');
        const backupNotesDir = path.join(notebookDir, 'notes');
        // 向量数据目录
        const vectorsDir = path.join(notebookUploadsDir, 'vectors');
        const backupVectorsDir = path.join(notebookDir, 'vectors');
        
        if (await fsExtra.pathExists(notebookUploadsDir)) {
          await fsExtra.ensureDir(backupDocsDir);
          this.logger.log(`Copying documents from ${notebookUploadsDir} to ${backupDocsDir}`);
          await fsExtra.copy(notebookUploadsDir, backupDocsDir);

          // 备份Markdown笔记文件
          if (await fsExtra.pathExists(notesMarkdownDir)) {
            this.logger.log(`Found and backing up markdown notes in ${notesMarkdownDir}`);
            await fsExtra.ensureDir(backupNotesDir);
            await fsExtra.copy(notesMarkdownDir, backupNotesDir);
          } else {
            this.logger.warn(`No markdown notes directory found for notebook ${nb.id} at ${notesMarkdownDir}`);
          }
          
          // 备份向量数据文件
          if (await fsExtra.pathExists(vectorsDir)) {
            this.logger.log(`Found and backing up vector data in ${vectorsDir}`);
            await fsExtra.ensureDir(backupVectorsDir);
            await fsExtra.copy(vectorsDir, backupVectorsDir);
          } else {
            this.logger.warn(`No vectors directory found for notebook ${nb.id} at ${vectorsDir}`);
          }
        } else {
          this.logger.warn(`Upload directory not found for notebook ${nb.id}, skipping document file copy.`);
        }
      }

      // 4. Create the zip stream
      const archive = archiver('zip', {
        zlib: { level: 9 } // Sets the compression level.
      });

      // Pipe archive data to a PassThrough stream to return
      // We don't close the stream here, the consumer (controller) should handle it.
      // Also, schedule cleanup AFTER the stream has been consumed/closed.
      
      // Good practice: use streams for large files/many files
      archive.directory(tempBackupDir, false);
      
      // Finalize the archive (writes end of central directory)
      // IMPORTANT: finalize() is async and returns a promise
      await archive.finalize();
      this.logger.log(`Archiving complete. Total bytes: ${archive.pointer()}`);

      // Create a readable stream FROM the finalized archive to return
      // We need to ensure the temp dir is cleaned up AFTER the stream is fully consumed.
      // This is tricky. A simpler approach for now might be to buffer in memory if backups aren't huge,
      // or use a file stream and clean up on 'close'. Let's return the archive stream directly,
      // but add a note about cleanup responsibility.
      
      this.logger.warn(`Temporary directory ${tempBackupDir} needs manual cleanup after stream consumption.`);
      // TODO: Implement robust cleanup for tempBackupDir after the stream is finished.

      return archive; // Return the archiver stream directly

    } catch (error) {
      this.logger.error(`Error during backup creation: ${error}`, error.stack);
      // Ensure cleanup even on error
      if (await fsExtra.pathExists(tempBackupDir)) {
        this.logger.log(`Cleaning up temporary directory due to error: ${tempBackupDir}`);
        await fsExtra.remove(tempBackupDir);
      }
      throw new HttpException('备份创建失败', HttpStatus.INTERNAL_SERVER_ERROR);
    }
    // Note: Need a robust way to clean up tempBackupDir AFTER the returned stream is consumed successfully.
    // For now, it might leak temp dirs on successful backups.
  }

  // Restore function implementation
  async restoreFromBackup(zipFilePath: string): Promise<{ message: string; restoredNotes: { notebookId: string; notesJsonString: string }[] }> {
    this.logger.log(`Starting restore process from zip file: ${zipFilePath}`);
    const tempExtractDir = path.join(os.tmpdir(), `notebook-restore-${crypto.randomBytes(8).toString('hex')}`);
    const restoredNotes: { notebookId: string; notesJsonString: string }[] = [];

    try {
      // 1. Ensure temp directory exists and extract the zip file
      await fsExtra.ensureDir(tempExtractDir);
      const zip = new AdmZip(zipFilePath);
      zip.extractAllTo(tempExtractDir, /*overwrite*/ true);
      this.logger.log(`Backup extracted to temporary directory: ${tempExtractDir}`);

      // 2. Read manifest (optional validation step)
      const manifestPath = path.join(tempExtractDir, 'backup_manifest.json');
      if (!await fsExtra.pathExists(manifestPath)) {
        throw new Error('Invalid backup file: backup_manifest.json not found.');
      }
      const manifest = await fsExtra.readJson(manifestPath);
      this.logger.log(`Backup manifest loaded. Version: ${manifest.backupVersion}, Notebooks: ${manifest.notebooks?.join(', ')}`);

      // 2.1 Restore folders first
      const foldersPath = path.join(tempExtractDir, 'folders.json');
      let restoredFolderIds = new Set<string>();
      
      if (await fsExtra.pathExists(foldersPath)) {
        const folders: Folder[] = await fsExtra.readJson(foldersPath);
        this.logger.log(`Found ${folders.length} folders in backup, restoring them first...`);
        
        for (const folder of folders) {
          try {
            // Check if folder already exists
            const existingFolder = await this.prisma.folder.findUnique({
              where: { id: folder.id }
            });
            
            if (existingFolder) {
              this.logger.log(`Folder ${folder.id} already exists, skipping creation.`);
              restoredFolderIds.add(folder.id);
            } else {
              // Create folder with original ID to maintain references
              await this.prisma.folder.create({
                data: { 
                  id: folder.id,
                  name: folder.name,
                  createdAt: folder.createdAt,
                  updatedAt: folder.updatedAt
                }
              });
              this.logger.log(`Restored folder: ${folder.id} - "${folder.name}"`);
              restoredFolderIds.add(folder.id);
            }
          } catch (error) {
            this.logger.error(`Error restoring folder ${folder.id}: ${error.message}`);
            // Continue with next folder rather than failing the whole process
          }
        }
      } else {
        this.logger.warn(`No folders.json found in backup. Folders will not be restored.`);
      }

      // 3. Iterate through notebook directories identified in the manifest
      if (!manifest.notebooks || !Array.isArray(manifest.notebooks)) {
         throw new Error('Invalid manifest: Missing or invalid notebooks array.');
      }

      for (const notebookId of manifest.notebooks) {
        this.logger.log(`Restoring notebook ID: ${notebookId}`);
        const notebookBackupDir = path.join(tempExtractDir, notebookId);
        const notebookUploadsDir = path.resolve(this.uploadsDir, notebookId);

        // Check if backup data exists for this notebook
        if (!await fsExtra.pathExists(notebookBackupDir)) {
            this.logger.warn(`Directory for notebook ${notebookId} not found in backup, skipping.`);
            continue;
        }

        // --- Simple Overwrite Strategy --- 
        this.logger.warn(`Performing overwrite restore for notebook ${notebookId}. Existing data will be deleted.`);
        
        // 4. Delete existing data
        try {
          await this.prisma.$transaction(async (tx) => {
            // 删除与笔记本相关的笔记
            await tx.notePadNote.deleteMany({ where: { notebookId: notebookId } });
            // Delete documents associated with the notebook
            await tx.document.deleteMany({ where: { notebookId: notebookId } });
            // Delete the notebook itself
            await tx.notebook.delete({ where: { id: notebookId } }); 
          });
          this.logger.log(`Deleted existing database records for notebook ${notebookId}.`);
        } catch (error) {
            // Handle case where notebook didn't exist (e.g., Prisma P2025 error)
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                this.logger.log(`Notebook ${notebookId} did not exist in DB. Proceeding with restore.`);
            } else {
                this.logger.error(`Error deleting existing DB data for notebook ${notebookId}: ${error}`);
                throw new Error(`数据库清理失败: ${error.message}`); // Re-throw to abort restore for this NB
            }
        }

        // Delete existing uploaded files directory for this notebook
        if (await fsExtra.pathExists(notebookUploadsDir)) {
          await fsExtra.remove(notebookUploadsDir);
          this.logger.log(`Deleted existing uploads directory: ${notebookUploadsDir}`);
        }
        // --- End of Deletion --- 

        // 5. Restore data from backup
        
        // 5a. Restore Notebook Metadata
        const metadataPath = path.join(notebookBackupDir, 'metadata.json');
        if (!await fsExtra.pathExists(metadataPath)) {
            throw new Error(`Missing metadata.json for notebook ${notebookId}.`);
        }
        
        const notebookMeta = await fsExtra.readJson(metadataPath);
        
        // Ensure ID matches directory name (basic sanity check)
        if (notebookMeta.id !== notebookId) {
            throw new Error(`ID mismatch in metadata.json for directory ${notebookId}.`);
        }
        
        // Check if the notebook has a folderId and if that folder exists
        if (notebookMeta.folderId && !restoredFolderIds.has(notebookMeta.folderId)) {
          this.logger.warn(`Notebook ${notebookId} references folder ${notebookMeta.folderId} which doesn't exist in restored folders. Removing folderId reference.`);
          // Remove the folderId to avoid foreign key constraint errors
          notebookMeta.folderId = null;
        }
        
        // Create the notebook record (omit id for creation)
        const { id, ...notebookCreateData } = notebookMeta; 
        await this.prisma.notebook.create({
            data: { id: notebookId, ...notebookCreateData } // Explicitly set the ID from backup
        });
        this.logger.log(`Restored notebook metadata for ${notebookId}`);

        // 5b. Restore Document Files and Markdown Notes
        const backupDocsPath = path.join(notebookBackupDir, 'documents');
        if (await fsExtra.pathExists(backupDocsPath)) {
          await fsExtra.ensureDir(notebookUploadsDir); // Recreate uploads dir
          await fsExtra.copy(backupDocsPath, notebookUploadsDir);
          this.logger.log(`Restored document files to ${notebookUploadsDir}`);
        } else {
          this.logger.log(`No 'documents' directory found in backup for ${notebookId}, skipping file restore.`);
        }

        // 5b.1 单独恢复Markdown笔记文件
        const backupNotesPath = path.join(notebookBackupDir, 'notes');
        const notebookNotesDir = path.join(notebookUploadsDir, 'notes');
        if (await fsExtra.pathExists(backupNotesPath)) {
          await fsExtra.ensureDir(notebookNotesDir);
          await fsExtra.copy(backupNotesPath, notebookNotesDir);
          this.logger.log(`Restored markdown notes files to ${notebookNotesDir}`);
        } else {
          this.logger.log(`No 'notes' directory found in backup for ${notebookId}, skipping markdown notes restore.`);
        }
        
        // 5b.2 单独恢复向量数据文件
        const backupVectorsPath = path.join(notebookBackupDir, 'vectors');
        const notebookVectorsDir = path.join(notebookUploadsDir, 'vectors');
        if (await fsExtra.pathExists(backupVectorsPath)) {
          await fsExtra.ensureDir(notebookVectorsDir);
          await fsExtra.copy(backupVectorsPath, notebookVectorsDir);
          this.logger.log(`Restored vector data files to ${notebookVectorsDir}`);
        } else {
          this.logger.log(`No 'vectors' directory found in backup for ${notebookId}, skipping vector data restore.`);
        }

        // 5c. Restore Document Metadata
        const documentsMetaPath = path.join(notebookBackupDir, 'documents_meta.json');
        if (!await fsExtra.pathExists(documentsMetaPath)) {
            this.logger.warn(`Missing documents_meta.json for notebook ${notebookId}, skipping document DB restore.`);
        } else {
            const documentsMeta: any[] = await fsExtra.readJson(documentsMetaPath);
            if (documentsMeta.length > 0) {
                // Prepare data for Prisma (ensure notebookId matches, potentially update paths if needed)
                const documentsToCreate = documentsMeta.map(doc => {
                  // Omit id for creation if letting Prisma generate
                  // Or keep ID if you want to preserve original IDs (might conflict)
                  const { id: docId, ...docData } = doc;
                  return { 
                      ...docData, 
                      id: docId, // Preserve original document ID from backup
                      notebookId: notebookId // Ensure association is correct
                      // filePath might need adjustment if upload structure changes, but likely okay if restoring to same base path
                  };
                });
                await this.prisma.document.createMany({ data: documentsToCreate });
                this.logger.log(`Restored ${documentsToCreate.length} document database records for ${notebookId}`);
            }
        }

        // 5c.1 恢复笔记元数据
        const notepadNotesPath = path.join(notebookBackupDir, 'notepad_notes.json');
        if (await fsExtra.pathExists(notepadNotesPath)) {
          const notepadNotes: NotePadNote[] = await fsExtra.readJson(notepadNotesPath);
          if (notepadNotes.length > 0) {
            // 准备数据用于Prisma创建
            const notesToCreate = notepadNotes.map(note => {
              // 保留原始ID以维持与Markdown文件的关联
              return { 
                id: note.id,
                title: note.title,
                content: note.content,
                createdAt: note.createdAt,
                updatedAt: note.updatedAt,
                notebookId: notebookId
              };
            });
            await this.prisma.notePadNote.createMany({ data: notesToCreate });
            this.logger.log(`Restored ${notesToCreate.length} notepad notes records for ${notebookId}`);
          }
        } else {
          this.logger.warn(`Missing notepad_notes.json for notebook ${notebookId}, skipping notes DB restore.`);
        }

        // 5d. Collect Notes Data for Frontend
        const notesPath = path.join(notebookBackupDir, 'notes.json');
        if (await fsExtra.pathExists(notesPath)) {
          const notesJsonString = await fsExtra.readFile(notesPath, 'utf-8');
          restoredNotes.push({ notebookId, notesJsonString });
          this.logger.log(`Collected notes data for ${notebookId}`);
        } else {
          this.logger.warn(`Missing notes.json for notebook ${notebookId}. Notes will not be restored.`);
          // Optionally add an empty entry so frontend knows to clear potentially existing notes
          restoredNotes.push({ notebookId, notesJsonString: '{\"notes\":[]}'}); 
        }
      }

      // 6. Restore Complete
      this.logger.log('Restore process completed successfully.');
      return { message: '备份恢复成功！', restoredNotes };

    } catch (error) {
      this.logger.error(`Error during restore process: ${error}`, error.stack);
      throw new HttpException(error.message || '备份恢复失败', HttpStatus.INTERNAL_SERVER_ERROR);
    } finally {
      // 7. Clean up temporary extraction directory
      if (await fsExtra.pathExists(tempExtractDir)) {
        this.logger.log(`Cleaning up temporary extraction directory: ${tempExtractDir}`);
        await fsExtra.remove(tempExtractDir);
      }
      // Also clean up the originally uploaded zip file
      if (await fsExtra.pathExists(zipFilePath)) {
         try {
           await fsExtra.unlink(zipFilePath);
           this.logger.log(`Cleaned up uploaded zip file: ${zipFilePath}`);
         } catch (cleanupError) {
            this.logger.error(`Error cleaning up uploaded zip file ${zipFilePath}: ${cleanupError}`);
         }
      }
    }
  }
} 
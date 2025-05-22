import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { WebDAVProvider } from './adapters/webdav.adapter';
// import { S3Provider } from './adapters/s3.adapter'; // Temporarily comment out S3 import
import { SyncProviderType } from './dto/sync-config.dto';
import { StorageProvider } from './adapters/storage-provider.interface';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as fsExtra from 'fs-extra';
import * as crypto from 'crypto';
import * as os from 'os';
import * as WebDAV from 'webdav';
import * as AWS from 'aws-sdk';
import {
  CreateSyncConfigDto,
  UpdateSyncConfigDto,
} from './dto/sync-config.dto';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  PrismaClient,
  Prisma,
  Notebook,
  Folder,
  Document,
} from '@prisma/client';
import { NotebooksService } from '../notebooks/notebooks.service';

// 声明模块扩展，让TypeScript知道PrismaClient具有syncConfig
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace PrismaClient {
    interface PrismaClient {
      syncConfig: any;
    }
  }
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private readonly uploadsDir: string;
  private isSyncing = false;

  // --- Constants for relative paths ---
  private readonly SYNC_META_DIR = 'notebook_sync_data';
  private readonly SYNC_META_FILE = 'sync_metadata.json';
  private readonly FOLDERS_FILE = 'folders.json'; // Kept for reference, not used directly in current logic
  private readonly NOTEBOOKS_DIR = 'notebooks';
  private readonly DOCUMENTS_DIR = 'documents';
  private readonly DOCS_META_FILE = 'documents_meta.json'; // Kept for reference, not used directly
  private readonly NOTES_FILE = 'notes.json';
  private readonly METADATA_FILE = 'metadata.json';

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private notebooksService: NotebooksService,
  ) {
    // Ensure UPLOAD_PATH is used consistently if it's defined in config
    this.uploadsDir = this.configService.get<string>('UPLOAD_PATH', 'uploads');
    if (!this.uploadsDir) {
      this.logger.error('UPLOAD_PATH configuration is missing or empty!');
      // Consider throwing an error or setting a default with a warning
      this.uploadsDir = 'uploads'; // Default fallback
    }
    this.logger.log(
      `Uploads directory set to: ${path.resolve(this.uploadsDir)}`,
    );
  }

  // 获取所有同步配置
  async getAllConfigs() {
    try {
      // Use type assertion temporarily if schema extension isn't picked up reliably
      const configs = await (this.prisma as any).syncConfig.findMany({
        select: {
          // Select only non-sensitive fields for listing
          id: true,
          name: true,
          type: true,
          webdavUrl: true, // Display URL for identification
          webdavUsername: true, // Display username for identification
          webdavPath: true,
          s3Region: true,
          s3Bucket: true,
          s3AccessKey: true, // Consider omitting sensitive keys even here
          s3Endpoint: true,
          s3Path: true,
          isActive: true,
          description: true,
          createdAt: true,
          updatedAt: true,
          // DO NOT SELECT passwords or secret keys here
        },
      });
      return configs;
    } catch (error) {
      this.logger.error(`Failed to get sync configs: ${error.message}`);
      throw new InternalServerErrorException(
        'Failed to get sync configurations',
      );
    }
  }

  // 获取单个同步配置 (potentially including sensitive data for internal use)
  async getConfig(id: string) {
    try {
      // Fetch potentially sensitive data needed for provider instance creation
      const config = await (this.prisma as any).syncConfig.findUnique({
        where: { id },
        // Include all fields needed for provider creation and operations
      });

      if (!config) {
        throw new NotFoundException(
          `Sync configuration with ID ${id} not found`,
        );
      }
      // Return the full config for internal use, be careful not to expose sensitive data externally
      return config;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to get sync config ${id}: ${error.message}`);
      throw new InternalServerErrorException(
        `Failed to get sync configuration`,
      );
    }
  }

  // 创建同步配置
  async createConfig(createDto: CreateSyncConfigDto) {
    this.validateConfig(createDto); // Validate before creation

    try {
      // Create config
      const config = await (this.prisma as any).syncConfig.create({
        data: {
          name: createDto.name,
          type: createDto.type,
          webdavUrl: createDto.webdavUrl,
          webdavUsername: createDto.webdavUsername,
          webdavPassword: createDto.webdavPassword, // Store password (consider hashing/encryption)
          webdavPath: createDto.webdavPath,
          s3Region: createDto.s3Region,
          s3Bucket: createDto.s3Bucket,
          s3AccessKey: createDto.s3AccessKey,
          s3SecretKey: createDto.s3SecretKey, // Store secret key (consider hashing/encryption)
          s3Endpoint: createDto.s3Endpoint,
          s3Path: createDto.s3Path,
          s3Acl: createDto.s3Acl,
          isActive: createDto.isActive ?? true,
          description: createDto.description,
        },
        select: {
          // Return non-sensitive fields after creation
          id: true,
          name: true,
          type: true,
          webdavUrl: true,
          webdavUsername: true,
          webdavPath: true,
          s3Region: true,
          s3Bucket: true,
          s3AccessKey: true,
          s3Endpoint: true,
          s3Path: true,
          s3Acl: true,
          isActive: true,
          description: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return config;
    } catch (error) {
      this.logger.error(
        `Failed to create sync config: ${error.message}`,
        error.stack,
      );
      // Check for unique constraint violation if applicable
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          'A sync configuration with this name might already exist.',
        );
      }
      throw new InternalServerErrorException(
        'Failed to create sync configuration',
      );
    }
  }

  // 更新同步配置
  async updateConfig(id: string, updateDto: UpdateSyncConfigDto) {
    const existingConfig = await this.getConfig(id); // Check if config exists
    this.validateConfig(updateDto); // Validate the update data

    // Prepare data, only include password/secret if provided in DTO
    const dataToUpdate: Prisma.SyncConfigUpdateInput = {
      name: updateDto.name,
      type: updateDto.type,
      webdavUrl: updateDto.webdavUrl,
      webdavUsername: updateDto.webdavUsername,
      webdavPath: updateDto.webdavPath,
      s3Region: updateDto.s3Region,
      s3Bucket: updateDto.s3Bucket,
      s3AccessKey: updateDto.s3AccessKey,
      s3Endpoint: updateDto.s3Endpoint,
      s3Path: updateDto.s3Path,
      s3Acl: updateDto.s3Acl,
      isActive: updateDto.isActive,
      description: updateDto.description,
    };
    if (updateDto.webdavPassword) {
      dataToUpdate.webdavPassword = updateDto.webdavPassword; // Update password if provided
    }
    if (updateDto.s3SecretKey) {
      dataToUpdate.s3SecretKey = updateDto.s3SecretKey; // Update secret key if provided
    }

    try {
      const updatedConfig = await (this.prisma as any).syncConfig.update({
        where: { id },
        data: dataToUpdate,
        select: {
          // Return non-sensitive fields after update
          id: true,
          name: true,
          type: true,
          webdavUrl: true,
          webdavUsername: true,
          webdavPath: true,
          s3Region: true,
          s3Bucket: true,
          s3AccessKey: true,
          s3Endpoint: true,
          s3Path: true,
          s3Acl: true,
          isActive: true,
          description: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return updatedConfig;
    } catch (error) {
      this.logger.error(
        `Failed to update sync config ${id}: ${error.message}`,
        error.stack,
      );
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          'A sync configuration with this name might already exist.',
        );
      }
      throw new InternalServerErrorException(
        'Failed to update sync configuration',
      );
    }
  }

  // 删除同步配置
  async deleteConfig(id: string) {
    await this.getConfig(id); // Ensure config exists before deleting

    try {
      await (this.prisma as any).syncConfig.delete({
        where: { id },
      });
      this.logger.log(`Successfully deleted sync configuration with ID: ${id}`);
      return {
        success: true,
        message: 'Sync configuration deleted successfully.',
      };
    } catch (error) {
      // Handle potential errors, e.g., related records preventing deletion if applicable
      this.logger.error(
        `Failed to delete sync config ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to delete sync configuration',
      );
    }
  }

  // 创建对应的存储提供商实例
  private createProviderInstance(config: any): StorageProvider {
    // Pass the full config object to the provider constructor
    try {
      switch (config.type) {
        // Inside createProviderInstance method
        case SyncProviderType.WEBDAV:
          if (
            !config.webdavUrl ||
            !config.webdavUsername ||
            !config.webdavPassword
          ) {
            throw new Error(
              'WebDAV configuration is incomplete (URL, Username, Password required).',
            );
          }

          // 创建一个新的配置对象，将 webdavXXX 字段映射到对应的 WebDAVProvider 预期的字段名
          const providerConfig = {
            ...config, // 复制所有字段
            url: config.webdavUrl, // 确保 url 字段存在，这是 WebDAVProvider 构造函数预期的
          };

          this.logger.debug(
            `Creating WebDAV provider with URL: ${providerConfig.url}, username: ${providerConfig.webdavUsername}, path: ${providerConfig.webdavPath || '/'}`,
          );

          // 使用映射后的配置对象创建 WebDAVProvider
          return new WebDAVProvider(providerConfig);

        case SyncProviderType.S3:
          this.logger.warn('S3 provider is currently disabled.');
          throw new BadRequestException('S3 provider is currently disabled.');
        /* // Original S3 code - Keep for reference
          if (!config.s3Region || !config.s3Bucket || !config.s3AccessKey || !config.s3SecretKey) {
               throw new Error('S3 configuration is incomplete (Region, Bucket, AccessKey, SecretKey required).');
          }
          return new S3Provider(config, this.logger);
          */

        default:
          throw new BadRequestException(
            `Unsupported storage type: ${config.type}`,
          );
      }
    } catch (error) {
      this.logger.error(
        `Failed to create provider instance for type ${config?.type}: ${error.message}`,
        error.stack,
      );
      // Throw a more specific error or re-throw the original
      throw new InternalServerErrorException(
        `创建存储提供商实例失败: ${error.message}`,
      );
    }
  }

  // 测试连接
  async testConnection(id: string) {
    const config = await this.getConfig(id); // Fetch full config for testing

    try {
      const provider = this.createProviderInstance(config);
      const result = await provider.testConnection();
      this.logger.log(
        `Connection test successful for config ${id} (${config.name}). Message: ${result.message}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Connection test failed for config ${id} (${config.name}): ${error.message}`,
      );
      // Return a structured error response
      throw new BadRequestException(`Connection test failed: ${error.message}`);
    }
  }

  // --- Simplified Sync Methods (Placeholder - use performTwoWaySync instead) ---
  async syncToCloud(id: string) {
    this.logger.warn(`syncToCloud is deprecated. Use performTwoWaySync.`);
    return this.performTwoWaySync(id);
  }
  async syncFromCloud(id: string) {
    this.logger.warn(`syncFromCloud is deprecated. Use performTwoWaySync.`);
    return this.performTwoWaySync(id);
  }
  // --- End Simplified Sync Methods ---

  // 私有方法: 验证配置 (Basic validation)
  private validateConfig(config: CreateSyncConfigDto | UpdateSyncConfigDto) {
    if (!config.name || config.name.trim() === '') {
      throw new BadRequestException('Configuration name cannot be empty.');
    }
    if (
      !config.type ||
      !Object.values(SyncProviderType).includes(config.type)
    ) {
      throw new BadRequestException(
        `Invalid sync provider type: ${config.type}`,
      );
    }

    if (config.type === SyncProviderType.WEBDAV) {
      // URL is always required for WebDAV
      if (!config.webdavUrl)
        throw new BadRequestException('WebDAV URL is required.');
      // Username is always required
      if (!config.webdavUsername)
        throw new BadRequestException('WebDAV username is required.');
      // Password is required only on creation, not necessarily on update unless provided
      if (config instanceof CreateSyncConfigDto && !config.webdavPassword) {
        throw new BadRequestException(
          'WebDAV password is required for new configurations.',
        );
      }
      // Validate URL format (basic)
      try {
        new URL(config.webdavUrl);
      } catch (e) {
        throw new BadRequestException('Invalid WebDAV URL format.');
      }
    } else if (config.type === SyncProviderType.S3) {
      // S3 is disabled, but keep validation logic for reference
      if (!config.s3Region)
        throw new BadRequestException('S3 region is required.');
      if (!config.s3Bucket)
        throw new BadRequestException('S3 bucket is required.');
      if (!config.s3AccessKey)
        throw new BadRequestException('S3 access key is required.');
      if (config instanceof CreateSyncConfigDto && !config.s3SecretKey) {
        throw new BadRequestException(
          'S3 secret key is required for new configurations.',
        );
      }
      // Basic validation for bucket name, etc. could be added
    }
  }

  // 私有方法: 测试WebDAV连接 (Moved to WebDAVProvider)
  // private async testWebDAVConnection(config: any) { ... }

  // 私有方法: 测试S3连接 (Moved to S3Provider)
  // private async testS3Connection(config: any) { ... }

  // 私有方法: 同步到WebDAV (Obsolete - logic moved to performTwoWaySync)
  // private async syncToWebDAV(config: any) { ... }

  // 私有方法: 从WebDAV同步 (Obsolete - logic moved to performTwoWaySync)
  // private async syncFromWebDAV(config: any) { ... }

  // 私有方法: 同步到S3 (Obsolete - logic moved to performTwoWaySync)
  // private async syncToS3(config: any) { ... }

  // 私有方法: 从S3同步 (Obsolete - logic moved to performTwoWaySync)
  // private async syncFromS3(config: any) { ... }

  // --- Scheduled Sync Task ---
  @Cron(CronExpression.EVERY_MINUTE) // Adjust cron expression as needed
  async handleScheduledSync() {
    if (this.isSyncing) {
      this.logger.log('Sync is already in progress. Skipping scheduled run.');
      return;
    }

    this.logger.log('Starting scheduled synchronization trigger...');
    let activeConfigs: any[] = []; // Use 'any' temporarily if prisma type isn't recognized

    try {
      activeConfigs = await (this.prisma as any).syncConfig.findMany({
        where: { isActive: true },
      });

      if (activeConfigs.length === 0) {
        this.logger.log(
          'No active sync configurations found for scheduled sync.',
        );
        return;
      }

      this.logger.log(
        `Found ${activeConfigs.length} active sync configurations.`,
      );
    } catch (error) {
      this.logger.error(
        'Error fetching active sync configurations for scheduled sync',
        error.stack,
      );
      return; // Don't proceed if fetching configs failed
    }

    // Prevent race conditions if schedule runs faster than sync completes
    this.isSyncing = true;
    try {
      for (const config of activeConfigs) {
        this.logger.log(
          `Initiating sync for config: ${config.name} (ID: ${config.id}) via schedule...`,
        );
        try {
          // Run sync non-await to allow multiple configs potentially in parallel?
          // Or await each one to run sequentially? Let's run sequentially for now.
          await this.performTwoWaySync(config.id);
          this.logger.log(
            `Scheduled sync finished for config: ${config.name} (ID: ${config.id})`,
          );
        } catch (syncError) {
          // performTwoWaySync should handle its internal errors, but catch unexpected ones here
          this.logger.error(
            `Unhandled error during scheduled sync for config ${config.id} (${config.name}): ${syncError.message}`,
            syncError.stack,
          );
          // Continue to the next config even if one fails
        }
      }
      this.logger.log('Scheduled synchronization cycle finished.');
    } finally {
      this.isSyncing = false; // Release the lock
    }
  }

  // Main two-way sync logic
  async performTwoWaySync(configId: string): Promise<void> {
    this.logger.log(
      `[Sync Start] Performing two-way sync for config ID: ${configId}`,
    );
    const syncStartTime = new Date(); // Record start time for potential timestamp updates
    let provider: StorageProvider | null = null; // Use interface type
    let remoteSyncMetaPath: string = '';
    let baseRemotePath: string = ''; // Store base path for relative calculations
    let syncSuccessful = false; // Flag to track overall success for timestamp update

    try {
      // --- 1. Get Config and Initialize Provider ---
      this.logger.verbose('[Sync Init] Fetching configuration...');
      const config = await this.prisma.syncConfig.findUnique({
        // Use standard prisma client
        where: { id: configId },
      });

      if (!config) {
        this.logger.error(
          `[Sync Init] Sync configuration ${configId} not found.`,
        );
        throw new NotFoundException(
          `Sync configuration ${configId} not found.`,
        );
      }
      if (!config.isActive) {
        this.logger.warn(
          `[Sync Init] Skipping sync for config ${configId}: Configuration is not active.`,
        );
        return; // Exit gracefully if inactive
      }
      // Currently only WebDAV is supported in this refactor
      if (config.type !== SyncProviderType.WEBDAV) {
        this.logger.warn(
          `[Sync Init] Skipping sync for config ${configId}: Unsupported type ${config.type}. Only WEBDAV is supported.`,
        );
        return;
      }

      this.logger.verbose('[Sync Init] Creating storage provider instance...');
      try {
        // Pass only the config object to the constructor
        provider = this.createProviderInstance(config);
        baseRemotePath = provider.getBasePath(); // Get base path from provider
        remoteSyncMetaPath = provider.joinPath(
          this.SYNC_META_DIR,
          this.SYNC_META_FILE,
        ); // Path relative to base
        this.logger.log(
          `[Sync Init] Provider created. Base Path: '${baseRemotePath}', Meta Path: '${remoteSyncMetaPath}'`,
        );
      } catch (providerError: any) {
        this.logger.error(
          `[Sync Init] Failed to initialize sync provider for ${configId}: ${providerError.message}`,
          providerError.stack,
        );
        throw new InternalServerErrorException(
          `Failed to initialize sync provider: ${providerError.message}`,
        ); // Re-throw as internal server error
      }

      // --- 2. Get Remote State (Metadata and File Listing) ---
      this.logger.verbose('[Sync Remote State] Fetching remote state...');
      let remoteSyncMeta: any = {};
      let remoteEntries: { [relativePath: string]: WebDAV.FileStat } = {}; // Map relative path to FileStat

      // Ensure base sync data directory exists remotely
      const remoteSyncMetaDirRelative = this.SYNC_META_DIR; // Directory relative to base path
      try {
        this.logger.verbose(
          `[Sync Remote State] Ensuring remote directory exists: ${remoteSyncMetaDirRelative}`,
        );
        await provider.ensureDir(remoteSyncMetaDirRelative); // Use relative path
      } catch (ensureError: any) {
        this.logger.error(
          `[Sync Remote State] Failed to ensure remote sync data directory (${remoteSyncMetaDirRelative}): ${ensureError.message}`,
          ensureError.stack,
        );
        throw ensureError; // Stop sync if base dir cannot be ensured
      }

      // Get remote sync metadata file content
      this.logger.verbose(
        `[Sync Remote State] Getting remote sync metadata from: ${remoteSyncMetaPath}`,
      );
      try {
        const metaContentBuffer =
          await provider.getFileContents(remoteSyncMetaPath); // Expect Buffer
        remoteSyncMeta = JSON.parse(metaContentBuffer.toString('utf-8'));
        this.logger.log(
          `[Sync Remote State] Successfully fetched and parsed remote sync metadata.`,
        );
      } catch (e: any) {
        // Treat 404 as first sync, re-throw others
        if (e?.status === 404 || (e?.message && e.message.includes('404'))) {
          this.logger.log(
            '[Sync Remote State] Remote sync metadata file not found. Assuming first sync or reset.',
          );
          remoteSyncMeta = {
            lastSync: null,
            folders: {},
            notebooks: {},
            documents: {},
          }; // Initialize empty meta
        } else {
          this.logger.error(
            `[Sync Remote State] Unexpected error getting remote sync metadata: ${e.message}`,
            e.stack,
          );
          throw e; // Re-throw other errors
        }
      }
      // Ensure structure after loading/initializing
      if (!remoteSyncMeta.folders) remoteSyncMeta.folders = {};
      if (!remoteSyncMeta.notebooks) remoteSyncMeta.notebooks = {};
      if (!remoteSyncMeta.documents) remoteSyncMeta.documents = {};

      // Get remote file listing (optional, used for checks) - Can be slow for large remotes
      // Consider making this optional or optimizing if performance is an issue
      this.logger.verbose(
        '[Sync Remote State] Fetching remote file listing (optional step)...',
      );
      try {
        const allRemoteEntriesRaw = (await provider.getDirectoryContents('', {
          deep: true,
          details: true,
        })) as WebDAV.FileStat[];
        this.logger.debug(
          `[Sync Remote State] Raw remote entries count: ${allRemoteEntriesRaw?.length ?? 0}`,
        );
        if (Array.isArray(allRemoteEntriesRaw)) {
          remoteEntries = allRemoteEntriesRaw.reduce(
            (map, entry) => {
              // Calculate path relative to the provider's base path
              const relativePath = provider!.getRelativePath(entry.filename);
              if (relativePath !== null) {
                // Only include entries within the base path
                map[relativePath] = entry;
              } else {
                this.logger.debug(
                  `[Sync Remote State] Skipping entry outside base path: ${entry.filename}`,
                );
              }
              return map;
            },
            {} as Record<string, WebDAV.FileStat>,
          );
          this.logger.verbose(
            `[Sync Remote State] Processed ${Object.keys(remoteEntries).length} relevant remote entries.`,
          );
        } else {
          this.logger.warn(
            `[Sync Remote State] getDirectoryContents did not return an array. Skipping remote entry processing.`,
          );
        }
      } catch (listError: any) {
        this.logger.error(
          `[Sync Remote State] Failed to list remote directory contents: ${listError.message}. Proceeding without remote listing.`,
        );
        // Proceed without remoteEntries, comparisons will rely solely on metadata
        remoteEntries = {};
      }

      // Determine the effective last sync time (from remote meta or epoch)
      const lastSyncTime = remoteSyncMeta.lastSync
        ? new Date(remoteSyncMeta.lastSync)
        : new Date(0);
      this.logger.log(
        `[Sync Init] Effective last sync timestamp: ${lastSyncTime.toISOString()}`,
      );

      // --- 3. Get Local State ---
      this.logger.verbose(
        '[Sync Local State] Fetching local state from database...',
      );
      // Fetch data needed for building local state AND deletion check
      const allLocalNotebooks = await this.prisma.notebook.findMany({
        include: {
          documents: true, // Get full document objects for buildLocalState
          folder: true, // Get folder object
        },
      });
      const localState = this.buildLocalState(allLocalNotebooks);
      this.logger.verbose(
        `[Sync Local State] Successfully built local state with ${Object.keys(localState.folders).length} folders, ${Object.keys(localState.notebooks).length} notebooks, ${Object.keys(localState.documents).length} documents.`,
      );

      // Prepare set of local doc IDs specifically for deletion check
      const allLocalDocIds = new Set<string>();
      allLocalNotebooks.forEach((nb) =>
        nb.documents.forEach((doc) => allLocalDocIds.add(doc.id)),
      );
      this.logger.verbose(
        `[Sync Deletion Check] Found ${allLocalDocIds.size} unique local document IDs for deletion check.`,
      );

      // --- 4. Compare States and Determine Actions ---
      this.logger.log('[Sync Compare] Comparing local and remote states...');
      const actions = {
        uploads: {
          folders: [] as any[],
          notebooks: [] as any[],
          documents: [] as any[],
          notes: [] as any[],
          docMeta: [] as any[],
        },
        downloads: {
          folders: [] as any[],
          notebooks: [] as any[],
          documents: [] as any[],
          notes: [] as any[],
          docMeta: [] as any[],
        },
        deletions: {
          documents: [] as {
            remotePath: string;
            id: string;
            notebookId: string;
          }[],
        },
      };
      // Create a deep copy of remote meta to modify during action determination/execution
      const updatedRemoteSyncMeta = JSON.parse(JSON.stringify(remoteSyncMeta));

      // --- 4a. Determine Deletions (Cloud side) ---
      this.logger.verbose(
        '[Sync Deletion Check] Identifying remote documents missing locally...',
      );
      let potentialDeletionCount = 0;
      const docsToDeleteCandidates: {
        remotePath: string;
        id: string;
        notebookId: string;
      }[] = [];

      if (updatedRemoteSyncMeta.documents) {
        for (const docId in updatedRemoteSyncMeta.documents) {
          if (!allLocalDocIds.has(docId)) {
            potentialDeletionCount++;
            const remoteDocMeta = updatedRemoteSyncMeta.documents[docId];
            if (remoteDocMeta && remoteDocMeta.notebookId) {
              // Construct the full remote path relative to provider base for the document's DIRECTORY
              const remoteDocDirPathRelative = this.buildRemotePath(
                this.NOTEBOOKS_DIR,
                remoteDocMeta.notebookId,
                this.DOCUMENTS_DIR,
                docId,
              );
              docsToDeleteCandidates.push({
                remotePath: remoteDocDirPathRelative, // Use relative path for provider action
                id: docId,
                notebookId: remoteDocMeta.notebookId,
              });
              this.logger.verbose(
                `[Sync Deletion Check] Candidate for remote deletion: ${remoteDocDirPathRelative} (ID: ${docId})`,
              );
            } else {
              this.logger.warn(
                `[Sync Deletion Check] Skipping potential deletion for doc ID ${docId} because notebookId is missing in remote metadata.`,
              );
            }
          }
        }
        this.logger.log(
          `[Sync Deletion Check] Identified ${potentialDeletionCount} remote documents not present locally.`,
        );
      } else {
        this.logger.log(
          '[Sync Deletion Check] No documents found in remote metadata to check for deletions.',
        );
      }

      // --- 4b. Apply Deletion Threshold ---
      let performCloudDeletions = false; // Flag to control execution
      if (docsToDeleteCandidates.length > 0) {
        const deleteThresholdStr = this.configService.get<string>(
          'SYNC_DELETE_THRESHOLD',
          '10',
        );
        let deleteThreshold = parseInt(deleteThresholdStr, 10);
        this.logger.log(
          `[Sync Deletion Threshold] Checking threshold. Candidates: ${docsToDeleteCandidates.length}, Configured Threshold: '${deleteThresholdStr}'`,
        );

        if (isNaN(deleteThreshold) || deleteThreshold < 0) {
          this.logger.warn(
            `[Sync Deletion Threshold] Invalid SYNC_DELETE_THRESHOLD ('${deleteThresholdStr}'). Using default of 10.`,
          );
          deleteThreshold = 10; // Use default if invalid
        }

        if (docsToDeleteCandidates.length > deleteThreshold) {
          this.logger.warn(
            `[Sync Deletion Threshold] Deletion count (${docsToDeleteCandidates.length}) exceeds threshold (${deleteThreshold}). SKIPPING remote deletions for this sync cycle.`,
          );
          performCloudDeletions = false;
        } else {
          this.logger.log(
            `[Sync Deletion Threshold] Deletion count is within threshold. Deletions will be attempted.`,
          );
          actions.deletions.documents = docsToDeleteCandidates; // Assign validated candidates to the action list
          performCloudDeletions = true;
        }
      }

      // --- 5. Execute Actions ---
      this.logger.log(
        '[Sync Execute] Executing determined synchronization actions...',
      );
      const currentSyncTime = new Date(); // Use a consistent timestamp for this sync cycle operations

      // --- 5a. Execute Deletions (Cloud side) ---
      if (performCloudDeletions && actions.deletions.documents.length > 0) {
        this.logger.log(
          `[Sync Execute Deletion] Executing ${actions.deletions.documents.length} remote document directory deletions...`,
        );
        let successfulDeletions = 0;
        let failedDeletions = 0;

        for (const deletion of actions.deletions.documents) {
          this.logger.log(
            `[Sync Execute Deletion] Attempting to delete remote directory: ${deletion.remotePath} (Document ID: ${deletion.id})`,
          ); // Path is relative
          try {
            if (typeof provider.deleteDirectory !== 'function') {
              this.logger.error(
                `[Sync Execute Deletion] Storage provider does not support the required 'deleteDirectory' method. Cannot delete ${deletion.remotePath}.`,
              );
              failedDeletions++;
              continue;
            }

            // 强制确保目录存在（如果不确定的话）
            try {
              // 获取远程目录内容，检查是否存在
              const dirContents = await provider.getDirectoryContents(
                deletion.remotePath,
              );
              this.logger.log(
                `[Sync Execute Deletion] Remote directory exists with ${dirContents.length} items before deletion.`,
              );
            } catch (checkError) {
              if (checkError.status === 404) {
                this.logger.warn(
                  `[Sync Execute Deletion] Remote directory ${deletion.remotePath} not found before delete attempt. Continuing as if deleted.`,
                );
                // 即使目录不存在，也应更新元数据
                if (
                  updatedRemoteSyncMeta.documents &&
                  updatedRemoteSyncMeta.documents[deletion.id]
                ) {
                  delete updatedRemoteSyncMeta.documents[deletion.id];
                  this.logger.verbose(
                    `[Sync Execute Deletion] Removed non-existent directory ${deletion.id} from metadata.`,
                  );
                  successfulDeletions++;
                }
                continue;
              }
              // 其他错误则记录但继续尝试删除
              this.logger.warn(
                `[Sync Execute Deletion] Error checking directory ${deletion.remotePath}: ${checkError.message}`,
              );
            }

            await provider.deleteDirectory(deletion.remotePath); // Use relative path
            this.logger.log(
              `[Sync Execute Deletion] Successfully deleted remote directory: ${deletion.remotePath}`,
            );

            // 额外检查目录是否真的被删除
            try {
              const postDirContents = await provider.getDirectoryContents(
                deletion.remotePath,
              );
              if (
                Array.isArray(postDirContents) &&
                postDirContents.length > 0
              ) {
                this.logger.warn(
                  `[Sync Execute Deletion] WARNING: Directory ${deletion.remotePath} still exists with ${postDirContents.length} items after delete operation!`,
                );
                // 尝试强制再次删除
                this.logger.log(
                  `[Sync Execute Deletion] Attempting force delete again...`,
                );
                await provider.deleteDirectory(deletion.remotePath);
                successfulDeletions++;
              } else {
                successfulDeletions++;
              }
            } catch (checkError) {
              if (checkError.status === 404) {
                // 404表示目录确实不存在了，这是正确的结果
                this.logger.log(
                  `[Sync Execute Deletion] Verified directory ${deletion.remotePath} no longer exists. Delete successful.`,
                );
                successfulDeletions++;
              } else {
                this.logger.warn(
                  `[Sync Execute Deletion] Could not verify deletion status: ${checkError.message}`,
                );
                // 假设成功，因为初始删除没有错误
                successfulDeletions++;
              }
            }

            // IMPORTANT: Remove from the *copied* remoteSyncMeta *after* successful deletion
            if (
              updatedRemoteSyncMeta.documents &&
              updatedRemoteSyncMeta.documents[deletion.id]
            ) {
              delete updatedRemoteSyncMeta.documents[deletion.id];
              this.logger.verbose(
                `[Sync Execute Deletion] Removed successfully deleted document ${deletion.id} from metadata to be saved.`,
              );
            }
          } catch (error) {
            failedDeletions++;
            this.logger.error(
              `[Sync Execute Deletion] Failed to delete remote directory ${deletion.remotePath} for doc ID ${deletion.id}: ${error.message}`,
              error.stack,
            );

            // 尽管删除失败，但如果是本地确实没有的文档，我们仍然需要从metadata中删除
            // 这样可以避免无法删除的远程文件一直出现在删除列表中
            if (
              updatedRemoteSyncMeta.documents &&
              updatedRemoteSyncMeta.documents[deletion.id]
            ) {
              this.logger.warn(
                `[Sync Execute Deletion] Removing document ${deletion.id} from metadata despite deletion failure to prevent sync loops.`,
              );
              delete updatedRemoteSyncMeta.documents[deletion.id];
            }
          }
        }
        this.logger.log(
          `[Sync Execute Deletion] Finished executing remote deletions. Success: ${successfulDeletions}, Failed: ${failedDeletions}`,
        );
      } else if (docsToDeleteCandidates.length > 0 && !performCloudDeletions) {
        this.logger.log(
          `[Sync Execute Deletion] Remote deletions were identified but skipped due to threshold.`,
        );
      } else {
        this.logger.log(
          `[Sync Execute Deletion] No remote deletions were scheduled for execution.`,
        );
      }

      // --- 5b. Execute Uploads ---
      this.logger.log('[Sync Execute Upload] Processing uploads...');
      if (!provider) throw new Error('Provider not initialized for uploads'); // Safety check

      // Upload Folders (Update remote meta based on local state)
      for (const folder of actions.uploads.folders) {
        this.logger.log(
          `[Sync Upload] Updating metadata for uploaded/changed folder: ${folder.id} (${folder.name})`,
        );
        if (!updatedRemoteSyncMeta.folders) updatedRemoteSyncMeta.folders = {};
        updatedRemoteSyncMeta.folders[folder.id] = {
          id: folder.id,
          name: folder.name,
          updatedAt: folder.updatedAt, // Already ISO string from buildLocalState
        };
      }

      // Upload Notebooks (Metadata & Notes)
      for (const notebook of actions.uploads.notebooks) {
        this.logger.log(
          `[Sync Upload] Uploading notebook ${notebook.id} (${notebook.title})...`,
        );
        const remoteNotebookDirRelative = this.buildRemotePath(
          this.NOTEBOOKS_DIR,
          notebook.id,
        );
        const remoteMetaPathRelative = this.buildRemotePath(
          remoteNotebookDirRelative,
          this.METADATA_FILE,
        );
        const remoteNotesPathRelative = this.buildRemotePath(
          remoteNotebookDirRelative,
          this.NOTES_FILE,
        );

        try {
          await provider.ensureDir(remoteNotebookDirRelative); // Ensure relative notebook directory exists

          // Fetch full notebook data fresh from DB
          const fullNotebookData = await this.prisma.notebook.findUnique({
            where: { id: notebook.id },
            select: {
              id: true,
              title: true,
              folderId: true,
              createdAt: true,
              updatedAt: true,
              userId: true,
            },
          });
          if (!fullNotebookData) {
            this.logger.warn(
              `[Sync Upload] Notebook ${notebook.id} disappeared from DB during upload execution. Skipping.`,
            );
            continue;
          }
          const currentUpdatedAt = fullNotebookData.updatedAt; // Use the most current timestamp

          // Prepare and upload metadata.json
          const metadataToUpload = {
            id: fullNotebookData.id,
            title: fullNotebookData.title,
            folderId: fullNotebookData.folderId,
            createdAt: fullNotebookData.createdAt.toISOString(),
            updatedAt: currentUpdatedAt.toISOString(),
          };
          await provider.putFileContents(
            remoteMetaPathRelative,
            Buffer.from(JSON.stringify(metadataToUpload, null, 2)),
          );
          this.logger.verbose(
            `[Sync Upload] Uploaded ${remoteMetaPathRelative}`,
          );

          // Fetch notes.json content using NotebooksService
          const userIdForNotes = fullNotebookData.userId;
          if (!userIdForNotes) {
            this.logger.error(`[Sync Upload] User ID not found for notebook ${notebook.id}. Cannot fetch notes.json. Skipping notes upload.`);
            // Optionally, upload an empty notes.json or handle as an error
            await provider.putFileContents(
              remoteNotesPathRelative,
              Buffer.from(JSON.stringify({ notes: "" }, null, 2)), // Upload empty notes
            );
            this.logger.verbose(
              `[Sync Upload] Uploaded EMPTY ${remoteNotesPathRelative} due to missing userId.`,
            );
          } else {
            const notesJsonString = await this.notebooksService.getNotebookNotesFromFile(notebook.id, userIdForNotes);
            const notesToUpload = { notes: notesJsonString || '' };

            await provider.putFileContents(
              remoteNotesPathRelative,
              Buffer.from(JSON.stringify(notesToUpload, null, 2)),
            );
            this.logger.verbose(
              `[Sync Upload] Uploaded ${remoteNotesPathRelative}`
            );
          }

          // Update remoteSyncMeta for the notebook using the fresh timestamp
          if (!updatedRemoteSyncMeta.notebooks)
            updatedRemoteSyncMeta.notebooks = {};
          updatedRemoteSyncMeta.notebooks[notebook.id] = {
            id: notebook.id,
            updatedAt: currentUpdatedAt.toISOString(),
          };
        } catch (error) {
          this.logger.error(
            `[Sync Upload] FAILED to upload notebook ${notebook.id}: ${error.message}`,
            error.stack,
          );
        }
      }

      // Upload Documents (File Content)
      for (const doc of actions.uploads.documents) {
        this.logger.log(
          `[Sync Upload] Uploading document ${doc.id} (${doc.fileName})...`,
        );
        // Construct paths: local absolute, remote relative
        const localDocDirPathAbsolute = path.resolve(
          this.uploadsDir,
          doc.notebookId,
          doc.id,
        );
        const localFilePathAbsolute = path.resolve(
          localDocDirPathAbsolute,
          doc.fileName,
        );
        const remoteDocDirPathRelative = this.buildRemotePath(
          this.NOTEBOOKS_DIR,
          doc.notebookId,
          this.DOCUMENTS_DIR,
          doc.id,
        );
        const remoteFilePathRelative = this.buildRemotePath(
          remoteDocDirPathRelative,
          doc.fileName,
        );

        try {
          await provider.ensureDir(remoteDocDirPathRelative); // Ensure remote relative directory exists

          if (!(await fsExtra.pathExists(localFilePathAbsolute))) {
            this.logger.warn(
              `[Sync Upload] Local file missing for document ${doc.id} at ${localFilePathAbsolute}. Skipping upload.`,
            );
            continue;
          }

          const fileBuffer = await fs.readFile(localFilePathAbsolute);
          await provider.putFileContents(remoteFilePathRelative, fileBuffer); // Use relative path for upload
          this.logger.verbose(
            `[Sync Upload] Uploaded document file ${localFilePathAbsolute} to ${remoteFilePathRelative}`,
          );

          // Update remoteSyncMeta (use fresh data from DB)
          const currentDocData = await this.prisma.document.findUnique({
            where: { id: doc.id },
            select: { updatedAt: true, fileSize: true },
          });
          if (!updatedRemoteSyncMeta.documents)
            updatedRemoteSyncMeta.documents = {};
          updatedRemoteSyncMeta.documents[doc.id] = {
            id: doc.id,
            fileName: doc.fileName,
            notebookId: doc.notebookId,
            updatedAt: currentDocData?.updatedAt.toISOString() || doc.updatedAt, // Prefer fresh timestamp
            fileSize: currentDocData?.fileSize ?? doc.fileSize, // Prefer fresh size
          };
        } catch (error) {
          this.logger.error(
            `[Sync Upload] FAILED to upload document ${doc.id} (${localFilePathAbsolute} to ${remoteFilePathRelative}): ${error.message}`,
            error.stack,
          );
        }
      }
      this.logger.log('[Sync Execute Upload] Finished processing uploads.');

      // --- 5c. Execute Downloads ---
      this.logger.log('[Sync Execute Download] Processing downloads...');
      if (!provider) throw new Error('Provider not initialized for downloads'); // Safety check

      // Download Folders (Create/Update local DB)
      for (const folderMeta of actions.downloads.folders) {
        this.logger.log(
          `[Sync Download] Downloading/updating folder ${folderMeta.id} (${folderMeta.name})...`,
        );
        try {
          await this.prisma.folder.upsert({
            where: { id: folderMeta.id },
            update: {
              name: folderMeta.name,
              updatedAt: new Date(folderMeta.updatedAt),
              // userId should not change on update if folder already exists and belongs to this user
            },
            create: {
              id: folderMeta.id,
              name: folderMeta.name,
              createdAt: new Date(folderMeta.updatedAt), // Use remote updatedAt as createdAt for new ones
              updatedAt: new Date(folderMeta.updatedAt),
              user: { connect: { id: config.userId } } // + ADDED user connect
            },
          });
          this.logger.verbose(
            `[Sync Download] Upserted folder ${folderMeta.id} locally for user ${config.userId}.`,
          );
        } catch (error) {
          this.logger.error(
            `[Sync Download] FAILED to upsert folder ${folderMeta.id}: ${error.message}`,
            error.stack,
          );
        }
      }

      // Download Notebooks (Metadata & Notes)
      for (const notebookMeta of actions.downloads.notebooks) {
        this.logger.log(
          `[Sync Download] Downloading notebook ${notebookMeta.id}...`,
        );
        const remoteNotebookDirRelative = this.buildRemotePath(
          this.NOTEBOOKS_DIR,
          notebookMeta.id,
        );
        const remoteMetaPathRelative = this.buildRemotePath(
          remoteNotebookDirRelative,
          this.METADATA_FILE,
        );
        const remoteNotesPathRelative = this.buildRemotePath(
          remoteNotebookDirRelative,
          this.NOTES_FILE,
        );

        try {
          // Download metadata.json
          const metaContentBuffer = await provider.getFileContents(
            remoteMetaPathRelative,
          );
          const downloadedMeta = JSON.parse(
            metaContentBuffer.toString('utf-8'),
          );
          this.logger.verbose(
            `[Sync Download] Downloaded ${remoteMetaPathRelative}`,
          );

          // Download notes.json
          let downloadedNotes = '';
          try {
            const notesContentBuffer = await provider.getFileContents(
              remoteNotesPathRelative,
            );
            const notesJson = JSON.parse(notesContentBuffer.toString('utf-8'));
            downloadedNotes = notesJson.notes || ''; // Extract the string value
            this.logger.verbose(`[Sync Download] Downloaded ${remoteNotesPathRelative}`);
          } catch (notesError) {
            this.logger.warn(`[Sync Download] Could not download or parse ${remoteNotesPathRelative} for notebook ${notebookMeta.id}. Notes will be empty. Error: ${notesError.message}`);
            downloadedNotes = ''; // Default to empty if notes.json is missing or corrupt
          }

          // Upsert notebook metadata (without notes field)
          const notebookCreatePayload: Prisma.NotebookCreateInput = {
            id: notebookMeta.id,
            title: downloadedMeta.title,
            // folderId: downloadedMeta.folderId, // Will be handled by 'folder' field
            createdAt: new Date(downloadedMeta.createdAt),
            updatedAt: new Date(downloadedMeta.updatedAt),
            user: { connect: { id: config.userId } },
          };
          if (downloadedMeta.folderId) {
            notebookCreatePayload.folder = { connect: { id: downloadedMeta.folderId } };
          }

          const notebookUpdatePayload: Prisma.NotebookUpdateInput = {
            title: downloadedMeta.title,
            // folderId: downloadedMeta.folderId, // Will be handled by 'folder' field
            updatedAt: new Date(downloadedMeta.updatedAt),
          };
          if (downloadedMeta.folderId === null) { // Explicitly unsetting folder
            notebookUpdatePayload.folder = { disconnect: true };
          } else if (downloadedMeta.folderId) { // Setting or changing folder
            notebookUpdatePayload.folder = { connect: { id: downloadedMeta.folderId } };
          }

          await this.prisma.notebook.upsert({
            where: { id: notebookMeta.id },
            create: notebookCreatePayload, // No 'notes' field here
            update: notebookUpdatePayload, // No 'notes' field here
          });
          this.logger.verbose(
            `[Sync Download] Upserted notebook metadata ${notebookMeta.id} locally for user ${config.userId}.`,
          );

          // Now, save the downloaded notes content to notes.json using NotebooksService
          try {
            // Pass an empty DTO for metadata update, as we only want to update the notes file.
            await this.notebooksService.update(notebookMeta.id, config.userId, {}, downloadedNotes);
            this.logger.verbose(
              `[Sync Download] Updated/created notes.json for notebook ${notebookMeta.id} via NotebooksService.`
            );
          } catch (notesSaveError) {
            this.logger.error(
              `[Sync Download] FAILED to save notes.json for notebook ${notebookMeta.id} using NotebooksService: ${notesSaveError.message}`,
              notesSaveError.stack,
            );
            // Decide if this is a critical error. For now, log and continue.
          }
        } catch (error) {
          this.logger.error(
            `[Sync Download] FAILED to download/upsert notebook ${notebookMeta.id}: ${error.message}`,
            error.stack,
          );
        }
      }

      // Download Documents (File Content & DB Record)
      for (const docMeta of actions.downloads.documents) {
        this.logger.log(
          `[Sync Download] Downloading document ${docMeta.id} (${docMeta.fileName})...`,
        );
        // Construct paths: remote relative, local absolute
        const remoteDocDirPathRelative = this.buildRemotePath(
          this.NOTEBOOKS_DIR,
          docMeta.notebookId,
          this.DOCUMENTS_DIR,
          docMeta.id,
        );
        const remoteFilePathRelative = this.buildRemotePath(
          remoteDocDirPathRelative,
          docMeta.fileName,
        );
        const localDocDirPathAbsolute = path.resolve(
          this.uploadsDir,
          docMeta.notebookId,
          docMeta.id,
        );
        const localFilePathAbsolute = path.resolve(
          localDocDirPathAbsolute,
          docMeta.fileName,
        );

        try {
          await fsExtra.ensureDir(localDocDirPathAbsolute); // Ensure local absolute directory exists
          this.logger.verbose(
            `[Sync Download] Ensured local directory exists: ${localDocDirPathAbsolute}`,
          );

          const fileBuffer = await provider.getFileContents(
            remoteFilePathRelative,
          ); // Download using relative path
          this.logger.verbose(
            `[Sync Download] Downloaded file content from ${remoteFilePathRelative}`,
          );

          await fs.writeFile(localFilePathAbsolute, fileBuffer); // Write to absolute path
          this.logger.verbose(
            `[Sync Download] Saved downloaded file to ${localFilePathAbsolute}`,
          );

          // Upsert Document in local DB
          const remoteUpdatedAt = new Date(docMeta.updatedAt);
          const approxCreatedAt = new Date(
            docMeta.createdAt || docMeta.updatedAt,
          ); // Estimate creation time

          await this.prisma.document.upsert({
            where: { id: docMeta.id },
            update: {
              fileName: docMeta.fileName,
              // notebookId: docMeta.notebookId, // Should not be updated like this
              fileSize: docMeta.fileSize ?? fileBuffer.length, // Use meta size or actual size
              filePath: localFilePathAbsolute, // Store absolute path
              updatedAt: remoteUpdatedAt, // Use timestamp from remote meta
              status: 'COMPLETED',
              statusMessage: 'Downloaded from cloud sync.',
              // userId is not typically changed on update for an existing document owned by a user
            },
            create: {
              id: docMeta.id,
              fileName: docMeta.fileName,
              // notebookId: docMeta.notebookId, // Replace with notebook connect object
              notebook: { connect: { id: docMeta.notebookId } }, // + ADDED notebook connect
              user: { connect: { id: config.userId } }, // + ADDED user connect (syncing user)
              fileSize: docMeta.fileSize ?? fileBuffer.length,
              filePath: localFilePathAbsolute, // Store absolute path
              createdAt: approxCreatedAt,
              updatedAt: remoteUpdatedAt,
              status: 'COMPLETED',
              statusMessage: 'Downloaded from cloud sync.',
              mimeType: docMeta.mimeType || 'application/octet-stream', 
            },
          });
          this.logger.verbose(
            `[Sync Download] Upserted document ${docMeta.id} locally for user ${config.userId}.`,
          );
        } catch (error) {
          this.logger.error(
            `[Sync Download] FAILED to download/upsert document ${docMeta.id} (${remoteFilePathRelative}): ${error.message}`,
            error.stack,
          );
          // Clean up partially downloaded file
          try {
            await fsExtra.remove(localFilePathAbsolute);
          } catch (cleanupError) {
            /* ignore */
          }
        }
      }
      this.logger.log('[Sync Execute Download] Finished processing downloads.');
      // --- End Execute Downloads ---

      // --- 6. Update Remote Sync Metadata ---
      this.logger.log('[Sync Finalize] Updating remote sync metadata...');
      updatedRemoteSyncMeta.lastSync = currentSyncTime.toISOString(); // Use the consistent time from start of execution
      // The updatedRemoteSyncMeta object now reflects changes from uploads and successful deletions
      await this.updateRemoteSyncMeta(
        provider,
        remoteSyncMetaPath,
        updatedRemoteSyncMeta,
      ); // Use relative path

      syncSuccessful = true; // Mark sync as successful *before* final timestamp update
      this.logger.log(
        `[Sync Success] Two-way sync successfully completed for config ${configId} at ${currentSyncTime.toISOString()}`,
      );
    } catch (error: any) {
      // This main catch block handles errors from initial setup or unhandled errors from sync steps
      this.logger.error(
        `[Sync Failure] Unrecoverable error during performTwoWaySync for ${configId}: ${error.message}`,
        error.stack,
      );
      syncSuccessful = false; // Ensure flag is false on any major error
      // Do not re-throw here, let finally block handle logging
    } finally {
      // --- 7. Update Local DB Timestamp (Optional, relies on remote meta mainly) ---
      // Only update local timestamp if the entire process seemed successful
      if (syncSuccessful && configId) {
        try {
          // Optional: Update local config's timestamp - disabled due to previous issues
          // await this.prisma.syncConfig.update({ where: { id: configId }, data: { lastSyncTimestamp: syncStartTime } });
          // this.logger.log(`[Sync Finalize] Successfully updated local DB timestamp for config ID: ${configId}`);
          this.logger.log(
            `[Sync Finalize] Local DB timestamp update is currently disabled. Sync relies on remote metadata timestamp.`,
          );
        } catch (timestampError: any) {
          this.logger.error(
            `[Sync Finalize] Failed to update local DB timestamp after successful sync for ${configId}: ${timestampError.message}`,
            timestampError.stack,
          );
        }
      } else {
        this.logger.warn(
          `[Sync Finalize] Sync failed or encountered errors for config ID: ${configId}. Local DB timestamp will not be updated.`,
        );
      }
      this.logger.log(
        `[Sync End] Finished sync attempt for config ID: ${configId}. Success: ${syncSuccessful}`,
      );
    }
  }

  // Helper: Builds local state object for comparison
  private buildLocalState(
    notebooks: (Notebook & { documents: Document[]; folder: Folder | null })[],
  ): any {
    this.logger.verbose(
      `[Build Local State] Building local state from ${notebooks.length} notebooks.`,
    );
    const localState = { folders: {}, notebooks: {}, documents: {} };

    const uniqueFolders = new Map<string, Folder>();
    notebooks.forEach((nb) => {
      if (nb.folder && !uniqueFolders.has(nb.folder.id)) {
        uniqueFolders.set(nb.folder.id, nb.folder);
      }
    });
    uniqueFolders.forEach((folder) => {
      localState.folders[folder.id] = {
        id: folder.id,
        name: folder.name,
        updatedAt: folder.updatedAt.toISOString(),
      };
    });
    this.logger.verbose(
      `[Build Local State] Processed ${uniqueFolders.size} unique folders.`,
    );

    notebooks.forEach((notebook) => {
      localState.notebooks[notebook.id] = {
        id: notebook.id,
        title: notebook.title,
        folderId: notebook.folderId,
        updatedAt: notebook.updatedAt.toISOString(),
        // Include notes or notesUpdatedAt if needed for comparison logic
      };
      notebook.documents.forEach((doc) => {
        localState.documents[doc.id] = {
          id: doc.id,
          fileName: doc.fileName,
          notebookId: doc.notebookId,
          fileSize: doc.fileSize,
          mimeType: doc.mimeType, // Include mimeType if needed
          updatedAt: doc.updatedAt.toISOString(), // Crucial for comparison
          // Include filePath if needed, but careful with absolute paths
          // filePath: doc.filePath,
          // Include contentHash if implemented
        };
      });
    });
    this.logger.verbose(
      `[Build Local State] Processed ${notebooks.length} notebooks and their documents.`,
    );
    return localState;
  }

  // Helper: Builds a normalized remote path using POSIX separators
  private buildRemotePath(...args: string[]): string {
    // Filter out any null or empty strings to prevent double slashes
    const validArgs = args.filter(
      (arg) => arg !== null && arg !== undefined && arg !== '',
    );
    // Use path.posix.join to ensure forward slashes, trim leading/trailing slashes
    const remotePath = path.posix.join(...validArgs).replace(/^\/|\/$/g, '');
    // this.logger.debug(`[Build Remote Path] Built path: ${remotePath} from args: ${args.join(', ')}`);
    return remotePath;
  }

  // Helper: Updates the remote sync_metadata.json file
  private async updateRemoteSyncMeta(
    provider: StorageProvider,
    remoteSyncMetaPath: string, // Relative path
    metadata: any,
  ): Promise<void> {
    this.logger.log(
      `[Update Remote Meta] Attempting to update remote metadata file: ${remoteSyncMetaPath}`,
    );
    try {
      if (typeof provider.putFileContents !== 'function') {
        throw new Error(
          'Storage provider does not support putFileContents method.',
        );
      }
      const metadataString = JSON.stringify(metadata, null, 2);
      const metadataBuffer = Buffer.from(metadataString, 'utf-8');
      await provider.putFileContents(remoteSyncMetaPath, metadataBuffer); // Use relative path
      this.logger.log(
        `[Update Remote Meta] Successfully updated remote metadata file: ${remoteSyncMetaPath}`,
      );
    } catch (error) {
      this.logger.error(
        `[Update Remote Meta] Failed to update remote metadata file ${remoteSyncMetaPath}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to update remote sync metadata: ${error.message}`,
      );
    }
  }
} // End of SyncService class

import { Injectable, Logger } from '@nestjs/common';
import { StorageProvider } from './storage-provider.interface';
import * as WebDAV from 'webdav';
import { FileStat, ResponseDataDetailed } from 'webdav/dist/node/types';
import { BufferLike } from 'webdav/dist/node/types.js'; // Import BufferLike
import { Readable } from 'stream';
import { EventEmitter } from 'events';
import * as path from 'path'; // Import path module

export interface WebDAVConfig {
  url: string;
  username?: string;
  password?: string;
  path?: string; // Optional base path on the server, e.g., '/dav/myfiles' or 'myfolder'
}

@Injectable()
export class WebDAVProvider extends EventEmitter implements StorageProvider {
  // Add this method inside WebDAVProvider class

  private client: WebDAV.WebDAVClient;
  private readonly logger = new Logger(WebDAVProvider.name);
  // Stored with leading slash, no trailing slash (unless it's just '/')
  private basePath: string;
  private options: { path: string; [key: string]: any }; // 添加 options 属性

  constructor(config: any) {
    // 1. 先调用 super()
    super();

    // 检查配置对象的有效性
    if (!config || typeof config !== 'object') {
      this.logger.error(
        `Invalid WebDAV configuration provided: ${JSON.stringify(config)}`,
      );
      throw new Error('Invalid WebDAV configuration: config must be an object');
    }

    // 检查 URL 是否存在
    if (!config.url || typeof config.url !== 'string' || !config.url.trim()) {
      this.logger.error(`WebDAV URL is missing or invalid: ${config.url}`);
      throw new Error('WebDAV URL is required and must be a non-empty string');
    }

    // 2. 初始化 options 对象
    this.options = { path: '/' };

    // 3. 设置客户端
    this.client = WebDAV.createClient(config.url, {
      username: config.webdavUsername,
      password: config.webdavPassword,
    });

    // 验证客户端是否创建成功
    if (!this.client) {
      this.logger.error('Failed to create WebDAV client');
      throw new Error('Failed to create WebDAV client');
    }

    // 4. 设置默认路径
    let basePath = '/';

    // 5. 如果配置中提供了有效的路径，则使用它
    const configuredPath = config.webdavPath;
    if (typeof configuredPath === 'string' && configuredPath.trim() !== '') {
      // 移除末尾斜杠保证统一
      basePath = configuredPath.trim().replace(/\/$/, '');
    }

    // 6. 保存 basePath 到两个地方
    this.basePath = basePath;
    this.options.path = basePath;

    this.logger.log(
      `WebDAV Provider initialized. Base Path: ${this.options.path}, URL: ${config.url}`,
    );
  }

  // Add public getter for basePath
  public getBasePath(): string {
    return this.basePath;
  }

  // --- Core Methods Required by StorageProvider/SyncService ---

  /**
   * Tests the connection by trying to list the root or base path.
   */
  async testConnection(): Promise<{ success: boolean; message?: string }> {
    try {
      // Use the internal basePath for testing
      await this.client.getDirectoryContents(this.basePath, {
        details: false,
        deep: false,
      });
      this.emit(
        'log',
        `WebDAV connection test successful for base path: ${this.basePath}`,
      );
      return { success: true, message: 'WebDAV connection successful' };
    } catch (error: any) {
      const errorMessage = `WebDAV connection test failed for base path ${this.basePath}: ${error.message}`;
      this.emit('error', errorMessage);
      this.logger.error(errorMessage, error.stack);
      return { success: false, message: `Connection failed: ${error.message}` };
    }
  }

  /**
   * Joins path segments using POSIX separators, ALWAYS resulting in a path relative to the WebDAV root.
   * It PREPENDS the configured basePath automatically.
   */
  private getFullPath(...segments: string[]): string {
    // Filter out empty/null segments and the root slash if passed explicitly
    const filteredSegments = segments.filter((s) => s && s !== '/');
    // Join the basePath with the filtered segments using posix rules
    const joined = path.posix.join(this.basePath, ...filteredSegments);
    this.logger.debug(
      `Constructed full path: [${this.basePath}] + [${filteredSegments.join('/')}] -> [${joined}]`,
    );
    return joined;
  }

  /**
   * Public method required by StorageProvider interface.
   * Joins segments using POSIX separators, suitable for constructing relative paths.
   * NOTE: Internal provider methods should use getFullPath() to work with absolute server paths.
   */
  joinPath(...segments: string[]): string {
    const filteredSegments = segments.filter((s) => s && s !== '/');
    return path.posix.join(...filteredSegments);
  }

  /**
   * Gets directory contents with details (needed for modification times).
   * Path is relative to the configured basePath.
   */
  async getDirectoryContents(
    remoteDirPath: string = '',
    options?: WebDAV.GetDirectoryContentsOptions,
  ): Promise<WebDAV.FileStat[]> {
    const fullPath = this.getFullPath(remoteDirPath);
    this.logger.debug(
      `Getting directory contents for: ${fullPath} (relative: '${remoteDirPath}')`,
    );

    // 检查 client 是否正确初始化
    if (
      !this.client ||
      typeof this.client.getDirectoryContents !== 'function'
    ) {
      const errorMsg = `WebDAV client not properly initialized when attempting to get directory contents: ${fullPath}`;
      this.logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    try {
      // Remove the incorrect cast and handle the result type
      const result = await this.client.getDirectoryContents(fullPath, options);
      this.emit(
        'log',
        `Fetched directory contents raw result for: ${fullPath}`,
      );

      // Check if the result is the detailed object containing a 'data' array
      if (
        result &&
        typeof result === 'object' &&
        Array.isArray((result as any).data)
      ) {
        this.logger.debug(
          `getDirectoryContents returning result.data (details=true likely)`,
        );
        return (result as any).data as WebDAV.FileStat[];
      }
      // Check if the result is already the array itself
      else if (Array.isArray(result)) {
        this.logger.debug(
          `getDirectoryContents returning result directly (details=false likely)`,
        );
        return result;
      }
      // Handle unexpected result types
      else {
        this.logger.error(
          `Unexpected result type from client.getDirectoryContents for ${fullPath}. Type: ${typeof result}`,
        );
        return []; // Return empty array on unexpected type
      }
    } catch (error: any) {
      if (error.status === 404) {
        this.logger.debug(`Directory not found (404) for path: ${fullPath}`);
        return []; // Return empty array if directory not found
      }
      this.logger.error(
        `Failed to get directory contents for ${fullPath}: ${error.message}`,
        error.stack,
      );
      throw new Error(
        `Failed to get directory contents for ${remoteDirPath}: ${error.message}`,
      );
    }
  }

  /**
   * Gets file contents, allowing format specification (e.g., 'text').
   * Path is relative to the configured basePath.
   */
  async getFileContents(
    remoteFilePath: string,
    options?: WebDAV.GetFileContentsOptions,
  ): Promise<any> {
    const fullPath = this.getFullPath(remoteFilePath);
    this.logger.debug(
      `Getting file contents for: ${fullPath} (relative: '${remoteFilePath}')`,
    );

    // 检查 client 是否正确初始化
    if (!this.client || typeof this.client.getFileContents !== 'function') {
      const errorMsg = `WebDAV client not properly initialized when attempting to get file contents: ${fullPath}`;
      this.logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    try {
      const content = await this.client.getFileContents(fullPath, options);
      this.emit('log', `Fetched file contents for: ${fullPath}`);
      return content;
    } catch (error: any) {
      if (error.status === 404) {
        throw error;
      }
      throw new Error(`Failed to get file contents: ${error.message}`);
    }
  }

  /**
   * Puts file contents.
   * Path is relative to the configured basePath.
   */
  async putFileContents(
    remoteFilePath: string,
    data: Buffer | string | Readable,
    options?: WebDAV.PutFileContentsOptions,
  ): Promise<void> {
    const fullPath = this.getFullPath(remoteFilePath);
    this.logger.debug(
      `Putting file contents to: ${fullPath} (relative: '${remoteFilePath}')`,
    );

    // 检查 client 是否正确初始化
    if (!this.client || typeof this.client.putFileContents !== 'function') {
      const errorMsg = `WebDAV client not properly initialized when attempting to put file contents: ${fullPath}`;
      this.logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    try {
      // Ensure parent directory exists using its FULL path
      const parentFullPath = path.posix.dirname(fullPath);
      if (
        parentFullPath &&
        parentFullPath !== '/' &&
        parentFullPath !== this.basePath
      ) {
        await this.client.createDirectory(parentFullPath, { recursive: true });
      }
      await this.client.putFileContents(fullPath, data, options);
      this.emit('log', `Put file contents to: ${fullPath}`);
    } catch (error: any) {
      // Add more detailed error logging
      this.logger.error(
        `Error in putFileContents for ${fullPath}. ` +
          `Status: ${error?.status}, Message: ${error?.message}, Code: ${error?.code}`,
        error, // Log the full error object if possible
      );
      // Re-throw a generic error for the service layer
      throw new Error(
        `Failed to put file contents to ${remoteFilePath}: ${error.message}`,
      );
    }
  }

  /**
   * Delete a file at the given remote path
   * @param remotePath Relative path from the configured root
   */
  async deleteFile(remotePath: string): Promise<void> {
    const fullPath = this.getFullPath(remotePath);
    this.logger.log(
      `[WebDAV] Attempting to delete file: ${remotePath} (Full URL: ${fullPath})`,
    );

    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        const response = await this.client.deleteFile(fullPath);
        this.logger.log(`[WebDAV] Successfully deleted file: ${remotePath}`);
        return;
      } catch (error) {
        retryCount++;

        // 如果文件不存在，认为删除成功
        if (error?.status === 404) {
          this.logger.warn(
            `[WebDAV] File not found when attempting to delete: ${remotePath}. Considering delete successful.`,
          );
          return;
        }

        // 最后一次尝试失败，抛出错误
        if (retryCount >= maxRetries) {
          this.logger.error(
            `[WebDAV] Failed to delete file after ${maxRetries} attempts: ${remotePath}. Error: ${error.message}`,
          );
          throw new Error(
            `Failed to delete WebDAV file ${remotePath}: ${error.message}`,
          );
        }

        // 非最后一次尝试失败，继续重试
        this.logger.warn(
          `[WebDAV] Delete file attempt ${retryCount}/${maxRetries} failed for ${remotePath}. Retrying in 1 second...`,
        );
        await new Promise((resolve) => setTimeout(resolve, 1000)); // 等待1秒后重试
      }
    }
  }

  /**
   * Delete a directory at the given remote path
   * @param remotePath Relative path from the configured root
   */
  async deleteDirectory(remotePath: string): Promise<void> {
    const fullPath = this.getFullPath(remotePath);
    this.logger.log(
      `[WebDAV] Attempting to delete directory: ${remotePath} (Full URL: ${fullPath})`,
    );

    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        // 首先检查目录是否存在
        try {
          await this.client.getDirectoryContents(fullPath);
        } catch (checkError) {
          if (checkError?.status === 404) {
            this.logger.warn(
              `[WebDAV] Directory not found when attempting to delete: ${remotePath}. Considering delete successful.`,
            );
            return;
          }
          // 其他错误则继续尝试删除
        }

        // WebDAVClient库的deleteFile方法也可用于删除目录
        const response = await this.client.deleteFile(fullPath);
        this.logger.log(
          `[WebDAV] Successfully deleted directory: ${remotePath}`,
        );

        // 验证目录确实被删除
        try {
          await this.client.getDirectoryContents(fullPath);
          this.logger.warn(
            `[WebDAV] Directory still exists after deletion: ${remotePath}. Attempting recursive deletion...`,
          );

          // 如果目录仍存在，尝试递归删除其内容
          try {
            // 获取目录内容
            const contents = await this.client.getDirectoryContents(fullPath);

            // 递归删除所有内容
            for (const item of Array.isArray(contents)
              ? contents
              : contents.data) {
              if (item.type === 'file') {
                await this.client.deleteFile(item.filename);
              } else if (item.type === 'directory') {
                await this.client.deleteFile(item.filename);
              }
            }

            // 再次尝试删除目录本身
            await this.client.deleteFile(fullPath);
            this.logger.log(
              `[WebDAV] Successfully deleted directory after recursive cleanup: ${remotePath}`,
            );
          } catch (recursiveError) {
            this.logger.error(
              `[WebDAV] Failed recursive deletion of ${remotePath}: ${recursiveError.message}`,
            );
            throw recursiveError;
          }
        } catch (verifyError) {
          if (verifyError?.status === 404) {
            // 404意味着目录确实不存在了，这是我们期望的结果
            this.logger.log(
              `[WebDAV] Verified directory no longer exists: ${remotePath}`,
            );
          } else {
            this.logger.warn(
              `[WebDAV] Could not verify deletion status: ${verifyError.message}`,
            );
          }
        }

        return;
      } catch (error) {
        retryCount++;

        // 如果目录不存在，认为删除成功
        if (error?.status === 404) {
          this.logger.warn(
            `[WebDAV] Directory not found when attempting to delete: ${remotePath}. Considering delete successful.`,
          );
          return;
        }

        // 最后一次尝试失败，抛出错误
        if (retryCount >= maxRetries) {
          this.logger.error(
            `[WebDAV] Failed to delete directory after ${maxRetries} attempts: ${remotePath}. Error: ${error.message}`,
          );
          throw new Error(
            `Failed to delete WebDAV directory ${remotePath}: ${error.message}`,
          );
        }

        // 非最后一次尝试失败，继续重试
        this.logger.warn(
          `[WebDAV] Delete directory attempt ${retryCount}/${maxRetries} failed for ${remotePath}. Retrying in 1 second...`,
        );
        await new Promise((resolve) => setTimeout(resolve, 1000)); // 等待1秒后重试
      }
    }
  }

  /**
   * Ensures a directory exists, creating it if necessary.
   * Path is relative to the configured basePath.
   */
  async ensureDir(remoteDirPath: string): Promise<void> {
    const fullPath = this.getFullPath(remoteDirPath);
    if (fullPath === '/' || fullPath === this.basePath) {
      this.logger.debug(
        `ensureDir called for base path or root, skipping creation.`,
      );
      return;
    }

    // 检查 client 是否存在及有效
    if (!this.client || typeof this.client.createDirectory !== 'function') {
      const errorMsg = `WebDAV client not properly initialized when attempting to create directory: ${fullPath}`;
      this.logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    // 尝试获取完整 URL 以进行检查
    try {
      // 这行仅作检查，确保 URL 是可构建的
      const baseUrl = (this.client as any).getAbsoluteUrl
        ? (this.client as any).getAbsoluteUrl()
        : null;
      if (!baseUrl) {
        this.logger.warn(
          `Could not determine WebDAV base URL, operations may fail`,
        );
      }
    } catch (err: any) {
      this.logger.warn(`Error checking WebDAV URL: ${err.message}`);
    }

    // Add more logging and try adding a trailing slash
    let pathForCreate = fullPath;
    if (!pathForCreate.endsWith('/')) {
      pathForCreate += '/';
    }
    this.logger.debug(
      `Attempting to ensure/create directory with path: ${pathForCreate} (Original fullPath: ${fullPath})`,
    );

    try {
      // Use the path with the trailing slash for the create call
      await this.client.createDirectory(pathForCreate, { recursive: true });
      this.emit('log', `Ensured directory exists: ${pathForCreate}`);
    } catch (error: any) {
      // Ignore 405 (Method Not Allowed - might mean dir exists) and 409 (Conflict - likely exists)
      if (error.status !== 405 && error.status !== 409) {
        this.logger.error(
          `Ensure directory failed for path ${pathForCreate}. Status: ${error.status}. Message: ${error.message}`,
        );
        throw new Error(
          `Failed to ensure directory ${remoteDirPath}: ${error.message}`,
        ); // Throw original relative path in error
      }
      this.logger.debug(
        `Ensure directory for ${pathForCreate} resulted in status ${error.status}, likely means directory already exists.`,
      );
    }
  }

  // --- Methods below might not be needed for the new sync logic or part of StorageProvider ---
  // Remove or comment out if not used by SyncService or StorageProvider interface

  /* 
  // Example: connect - testConnection is preferred for provider interface
  async connect(): Promise<boolean> {
    return (await this.testConnection()).success;
  }
  */

  /*
  // Example: listFiles - getDirectoryContents provides more info
  async listFiles(remotePath: string = ''): Promise<string[]> {
     const contents = await this.getDirectoryContents(remotePath);
     return contents.filter(item => item.type === 'file').map(item => item.basename);
  }
  */

  /*
  // Example: readFile - getFileContents is more flexible
  async readFile(remotePath: string): Promise<Buffer> {
    const content = await this.getFileContents(remotePath, { format: 'binary' });
     if (Buffer.isBuffer(content)) {
        return content;
      } else if (typeof content === 'string') {
        return Buffer.from(content);
      } else {
          // Handle stream or detailed response if necessary
          throw new Error('readFile expects Buffer, but received different type');
      }
  }
  */

  /*
  // Example: writeFile - putFileContents is the direct mapping
  async writeFile(remotePath: string, data: Buffer | string | Readable): Promise<void> {
      await this.putFileContents(remotePath, data);
  }
  */

  // Add this method inside WebDAVProvider class
  public getRelativePath(absoluteOrFullPath: string): string | null {
    const basePath = this.getBasePath();
    const normalizedFullPath = absoluteOrFullPath.replace(/\\/g, '/'); // Normalize separators
    const normalizedBasePath = basePath.replace(/\\/g, '/');

    // Ensure the path starts with the base path (plus a slash or being the same)
    if (normalizedFullPath === normalizedBasePath) {
      return ''; // Path is the base path itself
    } else if (normalizedFullPath.startsWith(normalizedBasePath + '/')) {
      // Get the part after the base path, remove leading slash
      const relative = normalizedFullPath
        .substring(normalizedBasePath.length)
        .replace(/^\//, '');
      return relative;
    } else {
      // Path is not within the base path
      this.logger?.debug(
        `Path "${normalizedFullPath}" is not within base path "${normalizedBasePath}".`,
      );
      return null;
    }
  }
}

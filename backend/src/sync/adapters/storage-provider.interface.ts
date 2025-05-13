import { FileStat, ResponseDataDetailed } from 'webdav/dist/node/types';
import { Readable } from 'stream';

export interface StorageProvider {
  getBasePath(): string;
  getRelativePath(absolutePath: string): string | null;
  /**
   * Tests the connection to the storage provider.
   * @returns An object indicating success and an optional message.
   */
  testConnection(): Promise<{ success: boolean; message?: string }>;

  /**
   * Joins path segments using the appropriate separator for the provider (e.g., / for WebDAV/S3).
   * This method should handle joining relative to any base path configured for the provider.
   * @param segments Path segments to join.
   * @returns The combined path.
   */
  joinPath(...segments: string[]): string;

  /**
   * Lists the contents of a remote directory.
   * @param remoteDirPath The path relative to the provider's base path. Defaults to the base path.
   * @param options Provider-specific options (e.g., { deep: true }).
   * @returns An array of file/directory stats (like WebDAV.FileStat or S3 Object info).
   */
  getDirectoryContents(remoteDirPath?: string, options?: any): Promise<any[]>; // Return type depends on provider

  /**
   * Reads the content of a remote file.
   * @param remoteFilePath The path relative to the provider's base path.
   * @param options Provider-specific options (e.g., { format: 'text' }).
   * @returns The file content, type depends on provider and options (e.g., Buffer, string, Stream).
   */
  getFileContents(remoteFilePath: string, options?: any): Promise<any>; // Use 'any' for broader compatibility

  /**
   * Writes data to a remote file, overwriting if it exists.
   * Should ensure parent directories exist.
   * @param remoteFilePath The path relative to the provider's base path.
   * @param data The data to write (Buffer, string, or Readable stream).
   * @param options Provider-specific options.
   */
  putFileContents(
    remoteFilePath: string,
    data: Buffer | string | Readable,
    options?: any,
  ): Promise<void>;

  /**
   * Deletes a remote file.
   * Should not fail if the file doesn't exist.
   * @param remoteFilePath The path relative to the provider's base path.
   */
  deleteFile(remoteFilePath: string): Promise<void>;

  /**
   * Deletes a remote directory recursively.
   * Should not fail if the directory doesn't exist.
   * @param remoteDirPath The path relative to the provider's base path.
   */
  deleteDirectory(remoteDirPath: string): Promise<void>;

  /**
   * Ensures a remote directory exists, creating it recursively if necessary.
   * @param remoteDirPath The path relative to the provider's base path.
   */
  ensureDir(remoteDirPath: string): Promise<void>;

  /**
   * Optional: Listen for events emitted by the provider (e.g., logs, errors).
   * This replaces the specific onTransferEvent.
   */
  on?(event: string | symbol, listener: (...args: any[]) => void): this;
  emit?(event: string | symbol, ...args: any[]): boolean;
}

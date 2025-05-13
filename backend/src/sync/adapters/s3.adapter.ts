/* // Temporarily comment out S3Provider to allow compilation while focusing on WebDAV
import { Injectable, Logger } from '@nestjs/common';
import { StorageProvider } from './storage-provider.interface';
import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";
import { EventEmitter } from 'events';
import * as path from 'path';

export interface S3Config {
    region: string;
    bucket: string;
    accessKey: string;
    secretKey: string;
    endpoint?: string; // Optional endpoint for S3 compatible storage
    path?: string; // Optional base path (prefix) within the bucket
    acl?: string; // Optional ACL
}

@Injectable()
export class S3Provider extends EventEmitter implements StorageProvider {
    private client: S3Client;
    private readonly logger = new Logger(S3Provider.name);
    private basePath: string;
    private bucketName: string;
    private acl?: string;

    constructor(private config: S3Config) {
        super();
        this.client = new S3Client({
            region: config.region,
            credentials: {
                accessKeyId: config.accessKey,
                secretAccessKey: config.secretKey,
            },
            endpoint: config.endpoint,
        });
        this.bucketName = config.bucket;
        this.basePath = config.path ? config.path.replace(/^\/|\/$/g, '') : ''; // Remove leading/trailing slashes for prefix
        this.acl = config.acl;
        this.logger.log(`S3 provider initialized. Bucket: ${this.bucketName}, Region: ${config.region}, BasePath: '${this.basePath}'`);
    }

    // --- Implement methods based on the OLD StorageProvider interface ---
    // --- TODO: Update these methods to match the NEW StorageProvider interface ---

    async connect(): Promise<boolean> {
        try {
            // Test connection by trying to list the root (or base path) with max 1 key
            const command = new ListObjectsV2Command({ Bucket: this.bucketName, Prefix: this.basePath ? `${this.basePath}/` : '/', MaxKeys: 1 });
            await this.client.send(command);
            this.logger.log('S3 connection successful');
            return true;
        } catch (error) {
            this.logger.error(`S3 connection failed: ${error.message}`, error.stack);
            return false;
        }
    }

    // Note: uploadFile/downloadFile using local paths are not ideal for sync service
    async uploadFile(localPath: string, remotePath: string): Promise<boolean> {
         this.logger.error('S3Provider uploadFile with localPath is deprecated for sync service.');
         return false; // Implement using putFileContents logic if needed elsewhere
    }

    async downloadFile(remotePath: string, localPath: string): Promise<boolean> {
        this.logger.error('S3Provider downloadFile with localPath is deprecated for sync service.');
        return false; // Implement using getFileContents logic if needed elsewhere
    }

    async listFiles(remotePath: string): Promise<string[]> {
        const prefix = path.posix.join(this.basePath, remotePath).replace(/^\/|\/$/g, ''); // Relative to base path
        const command = new ListObjectsV2Command({ Bucket: this.bucketName, Prefix: prefix ? `${prefix}/` : '' });
        try {
            const output = await this.client.send(command);
            const files = output.Contents?.map(item => path.basename(item.Key || '')).filter(Boolean) || []; // Get basenames
            this.logger.log(`Listed files under prefix: ${prefix}`);
            return files;
        } catch (error) {
            this.logger.error(`Failed to list files under prefix ${prefix}: ${error.message}`, error.stack);
            return [];
        }
    }

    async fileExists(remotePath: string): Promise<boolean> {
         const key = path.posix.join(this.basePath, remotePath).replace(/^\/|\/$/g, '');
        const command = new HeadObjectCommand({ Bucket: this.bucketName, Key: key });
        try {
            await this.client.send(command);
            return true;
        } catch (error: any) {
            if (error.name === 'NotFound') {
                return false;
            }
            this.logger.error(`Failed to check existence for key ${key}: ${error.message}`, error.stack);
            throw error; // Re-throw unexpected errors
        }
    }

    async getModifiedTime(remotePath: string): Promise<Date | null> {
         const key = path.posix.join(this.basePath, remotePath).replace(/^\/|\/$/g, '');
        const command = new HeadObjectCommand({ Bucket: this.bucketName, Key: key });
        try {
            const output = await this.client.send(command);
            return output.LastModified || null;
        } catch (error: any) {
             if (error.name === 'NotFound') {
                return null;
            }
             this.logger.error(`Failed to get modified time for key ${key}: ${error.message}`, error.stack);
             throw error; 
        }
    }

     async createDirectory(remotePath: string): Promise<boolean> {
         // S3 doesn't have real directories, often represented by empty objects ending in /
         const key = path.posix.join(this.basePath, remotePath).replace(/^\/|\/$/g, '');
         const command = new PutObjectCommand({
             Bucket: this.bucketName, 
             Key: `${key}/`, // Create an empty object with a trailing slash
             Body: '',
             ACL: this.acl as any
         });
         try {
             await this.client.send(command);
             this.logger.log(`Created S3 directory marker: ${key}/`);
             return true;
         } catch (error) {
             this.logger.error(`Failed to create S3 directory marker ${key}/: ${error.message}`, error.stack);
             return false;
         }
     }

    onTransferEvent(event: string, listener: (...args: any[]) => void): void {
        // S3 SDK v3 doesn't have built-in progress events like v2 easily accessible here
        // Need custom implementation or use lower-level APIs if progress is critical
        this.logger.warn('S3Provider onTransferEvent is not implemented for SDK v3 progress.');
        // Still allow listening for other events if needed via EventEmitter
        this.on(event, listener);
    }
}
*/

// API基础URL
export const API_URL = 'http://localhost:3001/api';

// 同步提供商类型
export enum SyncProviderType {
  WEBDAV = 'WEBDAV',
  S3 = 'S3',
}

// 常用的ACL选项
export const S3_ACL_OPTIONS = [
  { value: 'private', label: '私有 (private)' },
  { value: 'public-read', label: '公共读取 (public-read)' },
  { value: 'public-read-write', label: '公共读写 (public-read-write)' },
  { value: 'authenticated-read', label: '认证读取 (authenticated-read)' },
  { value: 'bucket-owner-read', label: '存储桶所有者读取 (bucket-owner-read)' },
  { value: 'bucket-owner-full-control', label: '存储桶所有者完全控制 (bucket-owner-full-control)' },
]; 
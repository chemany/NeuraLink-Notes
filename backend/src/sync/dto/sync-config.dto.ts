import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsUUID,
} from 'class-validator';
import { Exclude } from 'class-transformer';

export enum SyncProviderType {
  WEBDAV = 'WEBDAV',
  S3 = 'S3',
}

export class CreateSyncConfigDto {
  @IsString()
  name: string;

  @IsEnum(SyncProviderType)
  type: SyncProviderType;

  // WebDAV 相关字段
  @IsString()
  @IsOptional()
  webdavUrl?: string;

  @IsString()
  @IsOptional()
  webdavUsername?: string;

  @IsString()
  @IsOptional()
  webdavPassword?: string;

  @IsString()
  @IsOptional()
  webdavPath?: string;

  // S3 相关字段
  @IsString()
  @IsOptional()
  s3Region?: string;

  @IsString()
  @IsOptional()
  s3Bucket?: string;

  @IsString()
  @IsOptional()
  s3AccessKey?: string;

  @IsString()
  @IsOptional()
  s3SecretKey?: string;

  @IsString()
  @IsOptional()
  s3Endpoint?: string;

  @IsString()
  @IsOptional()
  s3Path?: string;

  @IsString()
  @IsOptional()
  s3Acl?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateSyncConfigDto extends CreateSyncConfigDto {
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class SyncConfigResponseDto {
  @IsUUID()
  id: string;

  @IsString()
  name: string;

  @IsEnum(SyncProviderType)
  type: SyncProviderType;

  @IsString()
  @IsOptional()
  webdavUrl?: string;

  @IsString()
  @IsOptional()
  webdavUsername?: string;

  @Exclude()
  webdavPassword?: string;

  @IsString()
  @IsOptional()
  webdavPath?: string;

  @IsString()
  @IsOptional()
  s3Region?: string;

  @IsString()
  @IsOptional()
  s3Bucket?: string;

  @IsString()
  @IsOptional()
  s3AccessKey?: string;

  @Exclude()
  s3SecretKey?: string;

  @IsString()
  @IsOptional()
  s3Endpoint?: string;

  @IsString()
  @IsOptional()
  s3Path?: string;

  @IsString()
  @IsOptional()
  s3Acl?: string;

  @IsBoolean()
  isActive: boolean;

  @IsString()
  @IsOptional()
  description?: string;

  createdAt: Date;
  updatedAt: Date;
}

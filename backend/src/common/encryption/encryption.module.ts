import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EncryptionService } from './encryption.service';

/**
 * @module EncryptionModule
 * @description 该模块负责提供加密和解密相关的服务。
 * 导入 ConfigModule 以允许 EncryptionService 访问环境变量，例如主加密密钥。
 */
@Module({
  imports: [ConfigModule], // 导入 ConfigModule 以便 EncryptionService 可以注入 ConfigService
  providers: [EncryptionService],
  exports: [EncryptionService], // 导出 EncryptionService 以便其他模块可以使用
})
export class EncryptionModule {} 
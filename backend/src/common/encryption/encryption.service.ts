import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // AES-256 需要 32 字节的密钥
const IV_LENGTH = 16; // GCM 推荐 12 字节的 IV，但 Node.js crypto 常用 16 字节且兼容
const AUTH_TAG_LENGTH = 16; // GCM 认证标签的长度

/**
 * @Injectable EncryptionService
 * @description 提供加密和解密功能的服务。
 * 包括处理用户特定密钥 (USEK) 的生成、加密和解密，
 * 以及文件内容的加密和解密。
 */
@Injectable()
export class EncryptionService {
  private readonly masterKey: Buffer;
  private readonly logger = new Logger(EncryptionService.name);

  constructor(private readonly configService: ConfigService) {
    const kekString = this.configService.get<string>('MASTER_ENCRYPTION_KEY');
    if (!kekString) {
      this.logger.error('MASTER_ENCRYPTION_KEY 未在环境变量中配置！');
      throw new InternalServerErrorException('加密服务配置错误，主密钥缺失。');
    }
    if (Buffer.from(kekString, 'hex').length !== KEY_LENGTH) {
        this.logger.error(`MASTER_ENCRYPTION_KEY 长度无效。期望 ${KEY_LENGTH} 字节 (${KEY_LENGTH * 2} 个十六进制字符)，实际得到 ${Buffer.from(kekString, 'hex').length} 字节。`);
        throw new InternalServerErrorException('加密服务配置错误，主密钥长度无效。');
    }
    this.masterKey = Buffer.from(kekString, 'hex');
    this.logger.log('EncryptionService 初始化成功，主密钥已加载。');
  }

  /**
   * @method generateKey
   * @description 生成一个指定长度的随机密钥 (Buffer)。
   * @param {number} length - 密钥长度（字节数）。默认为 KEY_LENGTH (32 字节)。
   * @returns {Buffer} 生成的密钥。
   */
  private generateKey(length: number = KEY_LENGTH): Buffer {
    return crypto.randomBytes(length);
  }

  /**
   * @method generateIv
   * @description 生成一个指定长度的随机初始化向量 (IV) (Buffer)。
   * @param {number} length - IV 长度（字节数）。默认为 IV_LENGTH (16 字节)。
   * @returns {Buffer} 生成的 IV。
   */
  private generateIv(length: number = IV_LENGTH): Buffer {
    return crypto.randomBytes(length);
  }

  /**
   * @method generateUserSpecificKey
   * @description 生成一个新的用户特定加密密钥 (USEK)。
   * @returns {Buffer} 生成的 USEK (32字节)。
   */
  generateUserSpecificKey(): Buffer {
    return this.generateKey();
  }

  /**
   * @method encryptUserSpecificKey
   * @description 使用主密钥 (KEK) 加密用户特定加密密钥 (USEK)。
   * @param {Buffer} userKey - 待加密的 USEK (Buffer)。
   * @returns {{ encryptedUserKey: Buffer; iv: Buffer }}
   *           包含加密后的 USEK (Buffer) 和用于加密的 IV (Buffer) 的对象。
   * @throws {InternalServerErrorException} 如果加密失败。
   */
  encryptUserSpecificKey(userKey: Buffer): { encryptedUserKey: Buffer; iv: Buffer } {
    try {
      const iv = this.generateIv();
      const cipher = crypto.createCipheriv(ALGORITHM, this.masterKey, iv);
      let encrypted = Buffer.concat([cipher.update(userKey), cipher.final()]);
      const authTag = cipher.getAuthTag();
      // 将认证标签附加到密文末尾
      const encryptedUserKey = Buffer.concat([encrypted, authTag]);
      return { encryptedUserKey, iv };
    } catch (error) {
      this.logger.error('加密用户特定密钥失败:', error);
      throw new InternalServerErrorException('加密用户特定密钥失败。');
    }
  }

  /**
   * @method decryptUserSpecificKey
   * @description 使用主密钥 (KEK) 解密用户特定加密密钥 (USEK)。
   * @param {Buffer} encryptedUserKeyWithAuthTag - 加密后的 USEK，已包含认证标签 (Buffer)。
   * @param {Buffer} iv - 加密时使用的 IV (Buffer)。
   * @returns {Buffer} 解密后的 USEK (Buffer)。
   * @throws {InternalServerErrorException} 如果解密失败 (例如 IV 错误、密钥错误或数据被篡改)。
   */
  decryptUserSpecificKey(encryptedUserKeyWithAuthTag: Buffer, iv: Buffer): Buffer {
    try {
      const decipher = crypto.createDecipheriv(ALGORITHM, this.masterKey, iv);
      // 从密文中分离认证标签
      const encryptedUserKey = encryptedUserKeyWithAuthTag.subarray(0, encryptedUserKeyWithAuthTag.length - AUTH_TAG_LENGTH);
      const authTag = encryptedUserKeyWithAuthTag.subarray(encryptedUserKeyWithAuthTag.length - AUTH_TAG_LENGTH);
      decipher.setAuthTag(authTag);
      const decrypted = Buffer.concat([decipher.update(encryptedUserKey), decipher.final()]);
      return decrypted;
    } catch (error) {
      this.logger.error('解密用户特定密钥失败:', error);
      // 这里的错误可能是由于错误的 IV、错误的 KEK 或数据被篡改
      throw new InternalServerErrorException('解密用户特定密钥失败，可能密钥不匹配或数据损坏。');
    }
  }

  /**
   * @method encryptData
   * @description 使用给定的密钥和IV加密数据 (AES-256-GCM)。
   * @param {Buffer} data - 待加密的明文数据 (Buffer)。
   * @param {Buffer} key - 用于加密的密钥 (Buffer, 通常是解密后的 USEK)。
   * @returns {{ encryptedData: Buffer; iv: Buffer; authTag: Buffer }}
   *           包含加密数据 (Buffer)、新生成的IV (Buffer) 和认证标签 (Buffer) 的对象。
   * @throws {InternalServerErrorException} 如果加密失败。
   */
  encryptData(data: Buffer, key: Buffer): { encryptedData: Buffer; iv: Buffer; authTag: Buffer } {
    try {
      const iv = this.generateIv(); // 为每次数据加密生成新的IV
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
      const encryptedPart = Buffer.concat([cipher.update(data), cipher.final()]);
      const authTag = cipher.getAuthTag();
      // 返回加密数据、IV和认证标签，因为GCM模式下IV和认证标签都需要与密文一起存储才能正确解密
      return { encryptedData: encryptedPart, iv, authTag };
    } catch (error) {
      this.logger.error('数据加密失败:', error);
      throw new InternalServerErrorException('数据加密操作失败。');
    }
  }

  /**
   * @method decryptData
   * @description 使用给定的密钥、IV和认证标签解密数据 (AES-256-GCM)。
   * @param {Buffer} encryptedData - 待解密的密文数据 (Buffer)。
   * @param {Buffer} key - 用于解密的密钥 (Buffer, 通常是解密后的 USEK)。
   * @param {Buffer} iv - 加密时使用的 IV (Buffer)。
   * @param {Buffer} authTag - 加密时生成的认证标签 (Buffer)。
   * @returns {Buffer} 解密后的明文数据 (Buffer)。
   * @throws {InternalServerErrorException} 如果解密失败 (例如 IV/密钥错误、数据被篡改)。
   */
  decryptData(encryptedData: Buffer, key: Buffer, iv: Buffer, authTag: Buffer): Buffer {
    try {
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);
      const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
      return decrypted;
    } catch (error) {
      this.logger.error('数据解密失败:', error);
      // 这里的错误可能是由于错误的IV、错误的密钥、数据被篡改或错误的认证标签
      throw new InternalServerErrorException('数据解密操作失败，可能密钥不匹配、数据损坏或认证失败。');
    }
  }

  // --- 流式加密/解密占位符 --- 
  // 为了简化初始实现，以上方法都基于 Buffer。 
  // 对于大文件，理想情况下应实现流式加密/解密。
  // 以下是未来可以扩展的流式方法签名（未完整实现）：

  /*
  async createEncryptionStream(key: Buffer, iv: Buffer): Promise<crypto.CipherGCM> {
    // TODO: 实现返回一个 CipherGCM 流
    // const iv = this.generateIv(); // 或者从参数接收
    // const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    // return cipher;
    throw new Error('流式加密尚未实现');
  }

  async createDecryptionStream(key: Buffer, iv: Buffer, authTag: Buffer): Promise<crypto.DecipherGCM> {
    // TODO: 实现返回一个 DecipherGCM 流
    // const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    // decipher.setAuthTag(authTag);
    // return decipher;
    throw new Error('流式解密尚未实现');
  }
  */
} 
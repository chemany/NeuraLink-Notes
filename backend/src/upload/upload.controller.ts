import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  HttpException,
  HttpStatus,
  Logger,
  Body,
  Delete,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';

// 统一图片保存目录为 process.cwd()/uploads/images，确保与静态托管一致
const uploadImageDir = path.join(process.cwd(), 'uploads/images');
const logger = new Logger('UploadController');

/**
 * 图片上传接口，接收 multipart/form-data，返回图片URL
 */
@Controller('upload')
export class UploadController {
  /**
   * 上传图片接口
   * @param file 上传的图片文件
   * @returns { url: string } 图片可访问URL
   */
  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          logger.log(`图片将保存到: ${uploadImageDir}`);
          cb(null, uploadImageDir);
        },
        filename: (req, file, cb) => {
          const ext = path.extname(file.originalname);
          const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
          logger.log(`保存图片文件名: ${filename}`);
          cb(null, filename);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          logger.warn('尝试上传非图片文件');
          return cb(new Error('只允许上传图片'), false);
        }
        cb(null, true);
      },
    }),
  )
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      logger.error('未收到文件');
      throw new HttpException('未收到文件', HttpStatus.BAD_REQUEST);
    }
    try {
      // 获取请求协议、主机（含端口）
      const protocol = (file as any)?.protocol || 'http';
      // 兼容代理和本地开发，优先取请求头
      const host =
        (file as any)?.host ||
        (typeof global !== 'undefined' && global['__HOST__']) ||
        'localhost:3001';
      // 尝试从请求对象获取host
      let reqHost = 'localhost:3001';
      try {
        reqHost =
          (this as any).host ||
          (this as any).req?.headers?.host ||
          'localhost:3001';
      } catch {}
      const url = `http://${reqHost}/uploads/images/${file.filename}`;
      logger.log(`图片上传成功: ${url}`);
      return { url };
    } catch (error) {
      logger.error(`图片上传失败: ${error.message}`);
      throw new HttpException(
        error.message || '图片上传失败',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 删除图片接口
   * @param body { url: string } 要删除的图片完整URL
   * @returns { success: boolean, error?: string }
   */
  @Delete('image')
  async deleteImage(@Body() body: { url: string }) {
    try {
      if (!body.url) {
        throw new HttpException('未提供图片URL', HttpStatus.BAD_REQUEST);
      }
      // 只允许删除本地上传的图片
      const prefix = 'http://localhost:3001/uploads/images/';
      if (!body.url.startsWith(prefix)) {
        throw new HttpException('禁止删除非本地图片', HttpStatus.FORBIDDEN);
      }
      const filename = body.url.replace(prefix, '');
      const filePath = path.join(process.cwd(), 'uploads/images', filename);
      if (!fs.existsSync(filePath)) {
        return { success: false, error: '文件不存在' };
      }
      fs.unlinkSync(filePath);
      logger.log(`图片已删除: ${filePath}`);
      return { success: true };
    } catch (error) {
      logger.error(`图片删除失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

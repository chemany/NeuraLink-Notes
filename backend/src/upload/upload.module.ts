import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';

/**
 * UploadModule 负责图片上传相关的依赖注入和路由注册
 */
@Module({
  controllers: [UploadController],
})
export class UploadModule {}

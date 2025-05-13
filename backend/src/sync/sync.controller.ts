import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  Logger,
  HttpStatus,
  HttpCode,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { SyncService } from './sync.service';
import {
  CreateSyncConfigDto,
  UpdateSyncConfigDto,
} from './dto/sync-config.dto';

@Controller('sync')
export class SyncController {
  private readonly logger = new Logger(SyncController.name);

  constructor(private readonly syncService: SyncService) {}

  // 获取所有同步配置
  @Get('configs')
  async getAllConfigs() {
    this.logger.log('Retrieving all sync configurations');
    return this.syncService.getAllConfigs();
  }

  // 获取单个同步配置
  @Get('configs/:id')
  async getConfig(@Param('id') id: string) {
    this.logger.log(`Retrieving sync configuration with id: ${id}`);
    return this.syncService.getConfig(id);
  }

  // 创建同步配置
  @Post('configs')
  async createConfig(@Body() createSyncConfigDto: CreateSyncConfigDto) {
    this.logger.log('Creating new sync configuration');

    // 验证根据选择的类型是否提供了必要的参数
    if (createSyncConfigDto.type === 'WEBDAV') {
      if (!createSyncConfigDto.webdavUrl) {
        throw new BadRequestException('WebDAV URL 是必需的');
      }
    } else if (createSyncConfigDto.type === 'S3') {
      if (
        !createSyncConfigDto.s3Region ||
        !createSyncConfigDto.s3Bucket ||
        !createSyncConfigDto.s3AccessKey ||
        !createSyncConfigDto.s3SecretKey
      ) {
        throw new BadRequestException('S3 配置缺少必需参数');
      }
    }

    return this.syncService.createConfig(createSyncConfigDto);
  }

  // 更新同步配置
  @Put('configs/:id')
  async updateConfig(
    @Param('id') id: string,
    @Body() updateSyncConfigDto: UpdateSyncConfigDto,
  ) {
    this.logger.log(`Updating sync configuration with id: ${id}`);
    return this.syncService.updateConfig(id, updateSyncConfigDto);
  }

  // 删除同步配置
  @Delete('configs/:id')
  async deleteConfig(@Param('id') id: string) {
    this.logger.log(`Deleting sync configuration with id: ${id}`);
    return this.syncService.deleteConfig(id);
  }

  // 测试连接
  @Post('configs/:id/test')
  async testConnection(@Param('id') id: string) {
    this.logger.log(`Testing connection for sync configuration with id: ${id}`);
    return this.syncService.testConnection(id);
  }

  // Remove the old zip-based sync endpoints
  /* 
  @Post('to-cloud/:id')
  @HttpCode(HttpStatus.ACCEPTED)
  async syncToCloud(@Param('id') id: string) {
    this.logger.log(`Starting sync to cloud for configuration with id: ${id}`);
    // This service method is likely removed or deprecated
    // return this.syncService.syncToCloud(id); 
    throw new BadRequestException('This endpoint is deprecated. Sync runs automatically.');
  }
  
  @Post('from-cloud/:id')
  @HttpCode(HttpStatus.ACCEPTED)
  async syncFromCloud(@Param('id') id: string) {
    this.logger.log(`Starting sync from cloud for configuration with id: ${id}`);
    // This service method is likely removed or deprecated
    // return this.syncService.syncFromCloud(id); 
     throw new BadRequestException('This endpoint is deprecated. Sync runs automatically.');
  }
  */

  // 恢复同步端点，使用新的双向同步实现
  @Post('to-cloud/:id')
  @HttpCode(HttpStatus.ACCEPTED)
  async syncToCloud(@Param('id') id: string) {
    this.logger.log(`开始手动同步到云端，配置ID: ${id}`);
    try {
      await this.syncService.performTwoWaySync(id);
      return {
        success: true,
        message: '数据已成功同步到云端',
      };
    } catch (error) {
      this.logger.error(`手动同步到云端失败: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`同步失败: ${error.message}`);
    }
  }

  @Post('from-cloud/:id')
  @HttpCode(HttpStatus.ACCEPTED)
  async syncFromCloud(@Param('id') id: string) {
    this.logger.log(`开始手动从云端同步，配置ID: ${id}`);
    try {
      await this.syncService.performTwoWaySync(id);
      return {
        success: true,
        message: '数据已成功从云端同步',
      };
    } catch (error) {
      this.logger.error(`手动从云端同步失败: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`同步失败: ${error.message}`);
    }
  }
}

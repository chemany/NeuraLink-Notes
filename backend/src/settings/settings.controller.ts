import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ValidationPipe,
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateUserSettingsDto } from './dto/update-user-settings.dto';
import { UnifiedAuthGuard, AuthenticatedRequest } from '../unified-auth/unified-auth.guard';

@Controller('settings') // API 基础路径为 /api/settings (通常 /api 前缀在 main.ts 中全局设置)
@UseGuards(UnifiedAuthGuard) // 对整个控制器应用统一认证保护
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getUserSettings(@Request() req: AuthenticatedRequest) {
    const userId = req.user.id;
    return this.settingsService.getUserSettings(userId);
  }

  @Get('full')
  @HttpCode(HttpStatus.OK)
  async getFullUserSettings(@Request() req: AuthenticatedRequest) {
    const userId = req.user.id;
    return this.settingsService.getFullUserSettings(userId);
  }

  @Put()
  @HttpCode(HttpStatus.OK)
  async updateUserSettings(
    @Request() req: AuthenticatedRequest,
    @Body(new ValidationPipe({ transform: true, whitelist: true })) // 使用 ValidationPipe 校验和转换 DTO
    updateUserSettingsDto: UpdateUserSettingsDto,
  ) {
    const userId = req.user.id;
    return this.settingsService.updateUserSettings(userId, updateUserSettingsDto);
  }
}

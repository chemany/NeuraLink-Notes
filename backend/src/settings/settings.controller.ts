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
    // 使用统一设置服务的用户ID，而不是本地数据库ID
    const userEmail = req.user.email;
    const unifiedUserId = this.getUserIdFromEmail(userEmail);
    console.log('[SettingsController] 获取完整设置，邮箱:', userEmail, '映射用户ID:', unifiedUserId);

    return this.settingsService.getFullUserSettingsFromUnified(unifiedUserId);
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

  /**
   * 根据用户邮箱映射到统一设置服务的用户ID
   * 这确保同一用户在不同应用中使用相同的设置文件
   */
  private getUserIdFromEmail(email: string): string {
    // 邮箱到用户名的映射
    const emailToUsername: Record<string, string> = {
      'link918@qq.com': 'jason'
      // 可以在这里添加更多映射
    };

    // 如果有映射，返回用户名，否则使用邮箱前缀
    const username = emailToUsername[email] || email.split('@')[0];

    console.log('[SettingsController] 邮箱映射:', email, '->', username);
    return username;
  }
}

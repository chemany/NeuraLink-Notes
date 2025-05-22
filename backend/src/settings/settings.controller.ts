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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; // 确保路径正确
import { User as UserModel } from '@prisma/client'; // Prisma User 模型

// 与其他控制器保持一致的 AuthenticatedRequest 接口定义
interface AuthenticatedRequest extends Request {
  user: Omit<UserModel, 'password'> & { id: string };
}

@Controller('settings') // API 基础路径为 /api/settings (通常 /api 前缀在 main.ts 中全局设置)
@UseGuards(JwtAuthGuard) // 对整个控制器应用认证保护
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getUserSettings(@Request() req: AuthenticatedRequest) {
    const userId = req.user.id;
    return this.settingsService.getUserSettings(userId);
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

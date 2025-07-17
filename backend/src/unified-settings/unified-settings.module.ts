import { Module } from '@nestjs/common';
import { UnifiedSettingsController } from './unified-settings.controller';
import { UnifiedSettingsService } from './unified-settings.service';
import { LocalSettingsService } from './local-settings.service';
import { UnifiedAuthModule } from '../unified-auth/unified-auth.module';

@Module({
  imports: [UnifiedAuthModule],
  controllers: [UnifiedSettingsController],
  providers: [UnifiedSettingsService, LocalSettingsService],
  exports: [UnifiedSettingsService, LocalSettingsService],
})
export class UnifiedSettingsModule {}
import { Module } from '@nestjs/common';
import { UnifiedSettingsController } from './unified-settings.controller';
import { UnifiedSettingsService } from './unified-settings.service';
import { LocalSettingsService } from './local-settings.service';

@Module({
  controllers: [UnifiedSettingsController],
  providers: [UnifiedSettingsService, LocalSettingsService],
  exports: [UnifiedSettingsService, LocalSettingsService],
})
export class UnifiedSettingsModule {}
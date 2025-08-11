import { Module } from '@nestjs/common';
import { ProxyController } from './proxy.controller';
import { ProxyService } from './proxy.service';
import { UnifiedSettingsModule } from '../unified-settings/unified-settings.module';
import { UnifiedAuthModule } from '../unified-auth/unified-auth.module';

@Module({
  imports: [UnifiedSettingsModule, UnifiedAuthModule],
  controllers: [ProxyController],
  providers: [ProxyService],
  exports: [ProxyService],
})
export class ProxyModule {} 
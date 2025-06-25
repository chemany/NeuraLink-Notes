import { Module } from '@nestjs/common';
import { NotePadController } from './notepad.controller';
import { NotePadService } from './notepad.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { UnifiedAuthModule } from '../unified-auth/unified-auth.module';

@Module({
  imports: [PrismaModule, ConfigModule, UnifiedAuthModule],
  controllers: [NotePadController],
  providers: [NotePadService],
  exports: [NotePadService],
})
export class NotePadModule {}

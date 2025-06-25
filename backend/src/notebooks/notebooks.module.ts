import { Module } from '@nestjs/common';
import { NotebooksController } from './notebooks.controller';
import { NotebooksService } from './notebooks.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { UnifiedAuthModule } from '../unified-auth/unified-auth.module';

@Module({
  imports: [PrismaModule, ConfigModule, UnifiedAuthModule],
  controllers: [NotebooksController],
  providers: [NotebooksService],
  exports: [NotebooksService],
})
export class NotebooksModule {}

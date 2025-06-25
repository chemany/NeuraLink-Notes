import { Module } from '@nestjs/common';
import { FoldersController } from './folders.controller';
import { FoldersService } from './folders.service';
import { PrismaModule } from '../prisma/prisma.module';
import { UnifiedAuthModule } from '../unified-auth/unified-auth.module';

@Module({
  imports: [PrismaModule, UnifiedAuthModule],
  controllers: [FoldersController],
  providers: [FoldersService],
})
export class FoldersModule {}

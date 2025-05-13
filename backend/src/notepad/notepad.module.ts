import { Module } from '@nestjs/common';
import { NotePadController } from './notepad.controller';
import { NotePadService } from './notepad.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [NotePadController],
  providers: [NotePadService],
})
export class NotePadModule {}

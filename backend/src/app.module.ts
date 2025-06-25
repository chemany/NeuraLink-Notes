import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { NotebooksModule } from './notebooks/notebooks.module';
import { DocumentsModule } from './documents/documents.module';
import { FoldersModule } from './folders/folders.module';
import { NotePadModule } from './notepad/notepad.module';
import { PrismaModule } from './prisma/prisma.module';
import { BackupModule } from './backup/backup.module';
import { SyncModule } from './sync/sync.module';
import { NotesModule } from './notes/notes.module';
import { UploadModule } from './upload/upload.module';
import { UnifiedAuthModule } from './unified-auth/unified-auth.module';
import { SettingsModule } from './settings/settings.module';
import { UnifiedSettingsModule } from './unified-settings/unified-settings.module';
import { ProxyModule } from './proxy/proxy.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    NotebooksModule,
    DocumentsModule,
    FoldersModule,
    NotePadModule,
    BackupModule,
    SyncModule,
    NotesModule,
    UploadModule,
    UnifiedAuthModule,
    SettingsModule,
    UnifiedSettingsModule,
    ProxyModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
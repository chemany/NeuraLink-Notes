import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
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
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [
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
    AuthModule,
    UserModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
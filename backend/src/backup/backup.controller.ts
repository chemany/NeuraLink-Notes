import {
  Controller,
  Post,
  Body,
  Res,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
  UseInterceptors,
  UploadedFile,
  HttpException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BackupService } from './backup.service';
import { Response } from 'express';
import { IsArray, IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { diskStorage } from 'multer'; // Import diskStorage for temporary file saving
import * as path from 'path';
import * as fs from 'fs'; // Import fs for directory check/creation

// DTO for individual notebook data in the request
class NotebookBackupRequestDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString() // Assuming notes are passed as stringified JSON
  @IsNotEmpty()
  notesJsonString: string;
}

// DTO for the main request body
class CreateBackupRequestDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NotebookBackupRequestDto)
  notebooks: NotebookBackupRequestDto[];
}

// --- Helper Function to ensure temp upload directory exists ---
const ensureTempUploadDirectoryExists = () => {
  const tempDir = './temp_uploads';
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  return tempDir;
};
// -------------------------------------------------------------

@Controller('backup')
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Post('create')
  @HttpCode(HttpStatus.OK) // Indicate success, although streaming happens
  @UsePipes(new ValidationPipe({ transform: true })) // Enable validation
  async createBackup(
    @Body() createBackupDto: CreateBackupRequestDto,
    @Res() res: Response, // Inject Response object for streaming
  ) {
    try {
      const zipStream = await this.backupService.createBackupZip(
        createBackupDto.notebooks,
      );

      // Set headers for file download
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="notebook_backup_${timestamp}.zip"`,
      );

      // Pipe the zip stream to the response
      zipStream.pipe(res);

      // Note: We rely on the stream ending to signal completion to the client.
      // Error handling within the service should throw exceptions, caught below.
      // Proper stream cleanup in the service is still needed.
    } catch (error) {
      // Service should throw HttpException, but catch others just in case
      res.status(error.status || HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: error.status || HttpStatus.INTERNAL_SERVER_ERROR,
        message: error.message || '备份创建过程中发生内部错误',
      });
    }
  }

  @Post('restore')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('backupFile', {
      // Use FileInterceptor to handle single file upload
      storage: diskStorage({
        // Save file temporarily to disk
        destination: (req, file, cb) => {
          const tempDir = ensureTempUploadDirectoryExists();
          cb(null, tempDir);
        },
        filename: (req, file, cb) => {
          // Generate a unique filename to avoid conflicts
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(
            null,
            file.fieldname +
              '-' +
              uniqueSuffix +
              path.extname(file.originalname),
          );
        },
      }),
      fileFilter: (req, file, cb) => {
        // Basic validation for zip files
        if (!file.originalname.match(/\.(zip)$/i)) {
          return cb(new Error('只允许上传 ZIP 文件!'), false);
        }
        cb(null, true);
      },
    }),
  )
  async restoreBackup(
    @UploadedFile() file: Express.Multer.File, // Get the uploaded file info
  ) {
    if (!file) {
      throw new HttpException(
        '未找到备份文件或文件上传失败',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Service method will handle cleanup of the temp file itself
    return await this.backupService.restoreFromBackup(file.path);
    // No need for try-catch here, let global exception filters handle service errors
    // or add specific try-catch if needed for controller-level actions after restore.
  }
}

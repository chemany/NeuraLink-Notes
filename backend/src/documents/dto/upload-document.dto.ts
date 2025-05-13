import { IsNotEmpty, IsString } from 'class-validator';

export class UploadDocumentDto {
  @IsString()
  @IsNotEmpty()
  notebookId: string; // 文件要关联到的笔记本 ID
}

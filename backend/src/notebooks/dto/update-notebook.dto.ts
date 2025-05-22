import { IsString, IsOptional, IsNotEmpty, IsUUID } from 'class-validator';

export class UpdateNotebookDto {
  @IsOptional()
  @IsNotEmpty({ message: '笔记本标题不能为空' })
  @IsString()
  title?: string;

  @IsOptional()
  @IsUUID('4', { message: '文件夹 ID 必须是有效的 UUID' })
  folderId?: string | null; // 允许为 null 以表示从文件夹中移除
}

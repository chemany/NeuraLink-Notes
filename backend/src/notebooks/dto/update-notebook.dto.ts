import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class UpdateNotebookDto {
  @IsOptional()
  @IsNotEmpty({ message: '笔记本标题不能为空' })
  @IsString({ message: '笔记本标题必须是字符串' })
  title?: string;

  @IsOptional()
  @IsString({ message: '文件夹ID必须是字符串' })
  @IsNotEmpty({ message: '文件夹ID不能为空字符串 (如果提供的话)'})
  folderId?: string | null; // 允许为 null 以表示从文件夹中移除
}

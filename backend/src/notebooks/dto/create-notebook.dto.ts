import { IsNotEmpty, IsString, MaxLength, IsOptional } from 'class-validator';

export class CreateNotebookDto {
  @IsString({ message: '标题必须是字符串' }) // 验证是字符串
  @IsNotEmpty({ message: '标题不能为空' }) // 验证不为空
  @MaxLength(100, { message: '标题长度不能超过100个字符' }) // 验证最大长度
  title: string;

  @IsString()
  @IsOptional()
  folderId?: string;
}

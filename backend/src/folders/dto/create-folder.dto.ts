import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class CreateFolderDto {
  @IsString({ message: '文件夹名称必须是字符串' })
  @IsNotEmpty({ message: '文件夹名称不能为空' })
  @MaxLength(100, { message: '文件夹名称不能超过100个字符' })
  name: string;

  @IsOptional()
  @IsString({ message: '父文件夹ID必须是字符串' })
  @IsNotEmpty({ message: '父文件夹ID不能为空字符串 (如果提供的话)' })
  parentId?: string;
}

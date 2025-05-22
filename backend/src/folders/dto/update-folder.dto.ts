import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class UpdateFolderDto {
  @IsOptional()
  @IsString({ message: '新的文件夹名称必须是字符串' })
  @IsNotEmpty({ message: '新的文件夹名称不能为空' })
  @MaxLength(100, { message: '新的文件夹名称不能超过100个字符' })
  name?: string;

  @IsOptional()
  @IsString({ message: '新的父文件夹ID必须是字符串' })
  newParentId?: string | null;
} 
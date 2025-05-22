import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class UpdateFolderDto {
  @IsOptional() // 在更新时，name 可能是可选的
  @IsNotEmpty({ message: '文件夹名称不能为空' })
  @IsString({ message: '文件夹名称必须是字符串' })
  name?: string;
} 
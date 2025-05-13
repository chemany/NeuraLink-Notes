import { IsString, IsOptional, IsUUID } from 'class-validator';

export class UpdateNotebookDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  folderId?: string | null;
}

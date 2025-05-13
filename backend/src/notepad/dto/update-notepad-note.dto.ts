import { IsString, IsOptional } from 'class-validator';

export class UpdateNotePadNoteDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  content?: string;
}

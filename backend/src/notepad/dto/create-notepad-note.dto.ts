import { IsString, IsOptional } from 'class-validator';

export class CreateNotePadNoteDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  content?: string;
}

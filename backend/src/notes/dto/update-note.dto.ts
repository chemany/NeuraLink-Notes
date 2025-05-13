import { IsString, IsOptional, IsJSON, MaxLength } from 'class-validator';

/**
 * DTO for updating an existing Note.
 * Defines the expected shape of data for note updates.
 * All fields are optional.
 */
export class UpdateNoteDto {
  /**
   * The new title of the note.
   * Optional, string, max length 255 characters.
   */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  /**
   * The new JSON content of the note.
   * Optional, should be a valid JSON string.
   */
  @IsOptional()
  @IsString() // Prisma's Json type expects a stringified JSON
  contentJson?: string;

  /**
   * The new HTML representation of the note content.
   * Optional, string.
   */
  @IsOptional()
  @IsString()
  contentHtml?: string;
}

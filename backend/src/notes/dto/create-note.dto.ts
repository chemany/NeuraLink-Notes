import { IsString, IsOptional, IsJSON, MaxLength } from 'class-validator';

/**
 * DTO for creating a new Note.
 * Defines the expected shape of data for note creation.
 */
export class CreateNoteDto {
  /**
   * The title of the note.
   * Optional, string, max length 255 characters.
   */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  /**
   * The JSON content of the note, typically from a Tiptap/ProseMirror editor.
   * Optional, should be a valid JSON string.
   */
  @IsOptional()
  @IsString() // Prisma's Json type expects a stringified JSON
  contentJson?: string;

  // contentJson?: string; // Store as string, Prisma handles Json conversion

  /**
   * The HTML representation of the note content.
   * Optional, string.
   */
  @IsOptional()
  @IsString()
  contentHtml?: string;
}

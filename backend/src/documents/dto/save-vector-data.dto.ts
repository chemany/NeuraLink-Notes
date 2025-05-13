import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// Define the structure for the metadata within a chunk
class DocumentChunkMetadataDto {
  @ApiProperty({ description: 'The ID of the original document.' })
  @IsNotEmpty()
  documentId: string;

  @ApiProperty({ description: 'The original filename of the document.' })
  @IsNotEmpty()
  documentName: string;

  @ApiProperty({ description: 'The index of this chunk within the document.' })
  @IsNotEmpty()
  chunkIndex: number;
}

// Define the structure for a single document chunk
class DocumentChunkDto {
  @ApiProperty({ description: 'Unique ID for the document chunk.' })
  @IsNotEmpty()
  id: string;

  @ApiProperty({ description: 'The text content of the chunk.' })
  @IsNotEmpty()
  content: string;

  @ApiProperty({
    description: 'The vector embedding for the chunk content.',
    type: [Number],
  })
  @IsArray()
  @IsNotEmpty()
  embedding: number[]; // Assuming embedding is required when saving

  @ApiProperty({ description: 'Metadata associated with the chunk.' })
  @ValidateNested()
  @Type(() => DocumentChunkMetadataDto)
  @IsNotEmpty()
  metadata: DocumentChunkMetadataDto;
}

// Define the main DTO for the request body
export class SaveVectorDataDto {
  @ApiProperty({
    description:
      'An array of document chunks, including their content, embeddings, and metadata.',
    type: [DocumentChunkDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DocumentChunkDto)
  @IsNotEmpty()
  vectorData: DocumentChunkDto[];
}

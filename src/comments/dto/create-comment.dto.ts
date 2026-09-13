import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/** Validated shape of a `POST songs/:songId/comments` request body. */
export class CreateCommentDto {
  @ApiProperty({ maxLength: 2000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  readonly body!: string;

  // Omitted for a top-level comment; set to reply to an existing comment
  // on the same song.
  @ApiPropertyOptional({
    description: 'The _id of the comment being replied to.',
  })
  @IsOptional()
  @IsMongoId()
  readonly parentCommentId?: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsMilitaryTime,
  IsOptional,
} from 'class-validator';

/**
 * Body of `PATCH /prisma/songs/bulk`. No `artists`: `updateMany` can't
 * change relations.
 */
export class BulkUpdateSongsDto {
  @ApiProperty({ type: [Number], example: [1, 2, 3] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsInt({ each: true })
  readonly ids!: number[];

  @ApiPropertyOptional({ example: '2024-01-15' })
  @IsOptional()
  @IsDateString()
  readonly releaseDate?: string;

  @ApiPropertyOptional({ example: '03:45', description: 'HH:MM' })
  @IsOptional()
  @IsMilitaryTime()
  readonly duration?: string;
}

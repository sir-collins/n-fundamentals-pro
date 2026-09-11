import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsMilitaryTime,
  IsString,
  IsNotEmpty,
  IsDateString,
} from 'class-validator';

/**
 * Validated shape of an incoming "create song" request body. Enforced
 * globally by the `ValidationPipe` registered in main.ts.
 */
export class CreateSongDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  readonly title!: string;

  // Artist *names*, resolved server-side (ArtistsService.findOrCreateMany)
  // into real Artist rows — not ids.
  @ApiProperty({ type: [String], example: ['The Weeknd'] })
  @IsNotEmpty()
  @IsArray()
  @IsString({ each: true })
  readonly artists!: string[];

  @ApiProperty({ example: '2024-01-15' })
  @IsNotEmpty()
  @IsDateString()
  readonly releaseDate!: string;

  // @IsMilitaryTime validates an "HH:MM" 24h time string — reused here for
  // song duration (e.g. "03:45") rather than a time of day.
  @ApiProperty({ example: '03:45', description: 'Song duration, HH:MM' })
  @IsNotEmpty()
  @IsMilitaryTime()
  readonly duration!: string;
}

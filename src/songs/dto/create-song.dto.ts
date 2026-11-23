import { ApiProperty } from '@nestjs/swagger';
import { Field, InputType } from '@nestjs/graphql';
import {
  IsArray,
  IsMilitaryTime,
  IsString,
  IsNotEmpty,
  IsDateString,
} from 'class-validator';

/**
 * Body of `POST /songs` and input of the `createSong` mutation. The global
 * `ValidationPipe` validates it on both APIs.
 */
@InputType()
export class CreateSongDto {
  @ApiProperty()
  @Field()
  @IsString()
  @IsNotEmpty()
  readonly title!: string;

  // Artist *names*, resolved server-side (ArtistsService.findOrCreateMany)
  // into real Artist rows — not ids.
  @ApiProperty({ type: [String], example: ['The Weeknd'] })
  @Field(() => [String])
  @IsNotEmpty()
  @IsArray()
  @IsString({ each: true })
  readonly artists!: string[];

  @ApiProperty({ example: '2024-01-15' })
  @Field()
  @IsNotEmpty()
  @IsDateString()
  readonly releaseDate!: string;

  // @IsMilitaryTime checks the "HH:MM" format; here it is a duration, not a
  // time of day.
  @ApiProperty({ example: '03:45', description: 'Song duration, HH:MM' })
  @Field()
  @IsNotEmpty()
  @IsMilitaryTime()
  readonly duration!: string;
}

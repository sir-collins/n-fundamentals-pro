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
 * Validated shape of an incoming "create song" request body. Enforced
 * globally by the `ValidationPipe` registered in main.ts — applies to
 * both REST (`@Body()`) and GraphQL (`@Args('input')`) since it's the
 * same global pipe either way. `@InputType()` also makes this class
 * usable directly as the `createSong` mutation's input type.
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

  // @IsMilitaryTime validates an "HH:MM" 24h time string — reused here for
  // song duration (e.g. "03:45") rather than a time of day.
  @ApiProperty({ example: '03:45', description: 'Song duration, HH:MM' })
  @Field()
  @IsNotEmpty()
  @IsMilitaryTime()
  readonly duration!: string;
}

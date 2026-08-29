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
  @IsString()
  @IsNotEmpty()
  readonly title!: string;

  @IsNotEmpty()
  @IsArray()
  @IsString({ each: true })
  readonly artists!: string[];

  @IsNotEmpty()
  @IsDateString()
  readonly releaseDate!: string;

  // @IsMilitaryTime validates an "HH:MM" 24h time string — reused here for
  // song duration (e.g. "03:45") rather than a time of day.
  @IsNotEmpty()
  @IsMilitaryTime()
  readonly duration!: string;
}

import {
  IsArray,
  IsMilitaryTime,
  IsString,
  IsNotEmpty,
  IsDateString,
} from 'class-validator';

export class CreateSongDto {
  @IsString()
  @IsNotEmpty()
  readonly title!: string;

  @IsNotEmpty()
  @IsArray()
  @IsString()
  readonly artists!: string[];

  @IsNotEmpty()
  @IsDateString()
  readonly releaseDate!: string;

  @IsNotEmpty()
  @IsMilitaryTime()
  readonly duration!: string;
}

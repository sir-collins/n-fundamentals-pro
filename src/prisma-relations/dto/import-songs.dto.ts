import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { CreateSongDto } from '../../songs/dto/create-song.dto';

/** Body of `POST /prisma/songs/bulk`. */
export class ImportSongsDto {
  @ApiProperty({ type: [CreateSongDto] })
  @IsArray()
  @ArrayMinSize(1)
  // Each song runs its own queries inside one transaction; capped to stay
  // well inside Prisma's transaction timeout.
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateSongDto)
  readonly songs!: CreateSongDto[];
}

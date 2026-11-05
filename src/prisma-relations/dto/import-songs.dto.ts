import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { CreateSongDto } from '../../songs/dto/create-song-dto';

/** Validated body of `POST /prisma/songs/bulk`. */
export class ImportSongsDto {
  // Same shape as CreateAlbumsDto: @Type turns each plain object into a
  // CreateSongDto so @ValidateNested can apply its rules.
  @ApiProperty({ type: [CreateSongDto] })
  @IsArray()
  @ArrayMinSize(1)
  // Every song is its own queries inside one transaction, which holds a
  // connection until it finishes — capped so it stays well inside
  // Prisma's transaction timeout.
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateSongDto)
  readonly songs!: CreateSongDto[];
}

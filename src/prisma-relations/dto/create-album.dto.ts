import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsString } from 'class-validator';

/**
 * Validated body of `POST /prisma/artists/:id/albums`. The artist comes
 * from the URL, not the body — the album is always created under it.
 */
export class CreateAlbumDto {
  @ApiProperty({ example: 'After Hours' })
  @IsString()
  @IsNotEmpty()
  readonly title!: string;

  @ApiProperty({ example: '2020-03-20' })
  @IsNotEmpty()
  @IsDateString()
  readonly releaseDate!: string;
}

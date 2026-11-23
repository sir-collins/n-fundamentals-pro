import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsString } from 'class-validator';

/** Body of `POST /prisma/artists/:id/albums`; the artist comes from the URL. */
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

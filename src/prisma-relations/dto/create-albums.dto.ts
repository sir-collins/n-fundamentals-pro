import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { CreateAlbumDto } from './create-album.dto';

/** Body of `POST /prisma/artists/:id/albums/bulk`. */
export class CreateAlbumsDto {
  @ApiProperty({ type: [CreateAlbumDto] })
  @IsArray()
  @ArrayMinSize(1)
  // The whole array is one INSERT; capped to bound the statement size.
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateAlbumDto)
  readonly albums!: CreateAlbumDto[];
}

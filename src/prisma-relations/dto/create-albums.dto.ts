import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { CreateAlbumDto } from './create-album.dto';

/** Validated body of `POST /prisma/artists/:id/albums/bulk`. */
export class CreateAlbumsDto {
  // @ValidateNested alone isn't enough: the JSON body holds plain objects,
  // and class-validator only knows CreateAlbumDto's rules on instances of
  // it. @Type tells class-transformer (ValidationPipe's `transform: true`)
  // to build one per element first.
  @ApiProperty({ type: [CreateAlbumDto] })
  @IsArray()
  @ArrayMinSize(1)
  // One INSERT for the whole array — capped so a single request can't
  // send an arbitrarily large statement.
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateAlbumDto)
  readonly albums!: CreateAlbumDto[];
}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SongsController } from './songs.controller';
import { SongsService } from './songs.service';
import { Song } from './entities/song.entity';
import { ArtistsModule } from '../artists/artists.module';

/**
 * Bundles the `songs` feature's controller and service.
 *
 * `TypeOrmModule.forFeature([Song])` registers `Song` with this module so
 * `@InjectRepository(Song)` in `SongsService` has something to inject —
 * without it, Nest wouldn't know a `Repository<Song>` should exist here.
 * `ArtistsModule` is imported for its exported `ArtistsService`, used to
 * resolve artist names to real rows when creating/updating a song.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Song]), ArtistsModule],
  controllers: [SongsController],
  providers: [SongsService],
})
export class SongsModule {}

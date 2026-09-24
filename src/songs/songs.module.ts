import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SongsController } from './songs.controller';
import { SongsService } from './songs.service';
import { SongsResolver } from './songs.resolver';
import { Song } from './entities/song.entity';
import { ArtistsModule } from '../artists/artists.module';

/**
 * Bundles the `songs` feature's controller, resolver, and service.
 *
 * `TypeOrmModule.forFeature([Song])` registers `Song` with this module so
 * `@InjectRepository(Song)` in `SongsService` has something to inject —
 * without it, Nest wouldn't know a `Repository<Song>` should exist here.
 * `ArtistsModule` is imported for its exported `ArtistsService`, used to
 * resolve artist names to real rows when creating/updating a song.
 * Exports `SongsService` so `CommentsModule` can validate a `songId`
 * actually refers to a real song before attaching a comment to it.
 * `SongsResolver` is the GraphQL layer over that same `SongsService` —
 * REST (`SongsController`) and GraphQL are parallel API surfaces, not
 * duplicated logic.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Song]), ArtistsModule],
  controllers: [SongsController],
  providers: [SongsService, SongsResolver],
  exports: [SongsService],
})
export class SongsModule {}

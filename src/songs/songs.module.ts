import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SongsController } from './songs.controller';
import { SongsService } from './songs.service';
import { SongsResolver } from './songs.resolver';
import { Song } from './entities/song.entity';
import { ArtistsModule } from '../artists/artists.module';

/**
 * Songs over REST and GraphQL, both backed by `SongsService`. Exports the
 * service so `CommentsModule` can check a `songId` exists.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Song]), ArtistsModule],
  controllers: [SongsController],
  providers: [SongsService, SongsResolver],
  exports: [SongsService],
})
export class SongsModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SongsController } from './songs.controller';
import { SongsService } from './songs.service';
import { Song } from './entities/song.entity';

/**
 * Bundles the `songs` feature's controller and service.
 *
 * `TypeOrmModule.forFeature([Song])` registers `Song` with this module so
 * `@InjectRepository(Song)` in `SongsService` has something to inject —
 * without it, Nest wouldn't know a `Repository<Song>` should exist here.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Song])],
  controllers: [SongsController],
  providers: [SongsService],
})
export class SongsModule {}

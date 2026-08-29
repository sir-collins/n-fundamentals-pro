import { Module } from '@nestjs/common';
import { SongsController } from './songs.controller';
import { SongsService } from './songs.service';

/** Bundles the `songs` feature's controller and service. */
@Module({
  controllers: [SongsController],
  providers: [SongsService],
})
export class SongsModule {}

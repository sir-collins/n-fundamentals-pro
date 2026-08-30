import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Artist } from './entities/artist.entity';
import { ArtistsService } from './artists.service';

/**
 * No controller yet — artists are only created indirectly, through songs,
 * for now. Exports `ArtistsService` so `SongsModule` can resolve artist
 * names to real rows.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Artist])],
  providers: [ArtistsService],
  exports: [ArtistsService],
})
export class ArtistsModule {}

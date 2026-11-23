import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Artist } from './entities/artist.entity';
import { ArtistsService } from './artists.service';
import { DeezerService } from './deezer.service';
import { ArtistsResolver } from './artists.resolver';
import { OrphanArtistsCleanupJob } from './orphan-artists-cleanup.job';

/**
 * No REST controller: artists are created through songs. Exports
 * `ArtistsService` for `SongsModule` and both services for the GraphQL
 * loaders built in `AppModule`.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Artist])],
  providers: [
    ArtistsService,
    DeezerService,
    ArtistsResolver,
    OrphanArtistsCleanupJob,
  ],
  exports: [ArtistsService, DeezerService],
})
export class ArtistsModule {}

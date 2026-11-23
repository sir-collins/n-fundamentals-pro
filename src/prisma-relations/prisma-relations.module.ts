import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaArtistsController } from './prisma-artists.controller';
import { PrismaBulkSongsController } from './prisma-bulk-songs.controller';
import { PrismaLyricsController } from './prisma-lyrics.controller';
import { PrismaRelationsService } from './prisma-relations.service';

/**
 * Prisma relations and bulk operations: Artist → Albums (one-to-many) at
 * `/prisma/artists`, Song → Lyrics (one-to-one) at
 * `/prisma/songs/:id/lyrics`, and bulk song import/update at
 * `/prisma/songs/bulk`.
 */
@Module({
  imports: [PrismaModule],
  controllers: [
    PrismaArtistsController,
    PrismaLyricsController,
    PrismaBulkSongsController,
  ],
  providers: [PrismaRelationsService],
})
export class PrismaRelationsModule {}

import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaArtistsController } from './prisma-artists.controller';
import { PrismaLyricsController } from './prisma-lyrics.controller';
import { PrismaRelationsService } from './prisma-relations.service';

/**
 * Project 9's relations: Artist → Albums (one-to-many) at
 * `/prisma/artists`, Song → Lyrics (one-to-one) at
 * `/prisma/songs/:id/lyrics`.
 */
@Module({
  imports: [PrismaModule],
  controllers: [PrismaArtistsController, PrismaLyricsController],
  providers: [PrismaRelationsService],
})
export class PrismaRelationsModule {}

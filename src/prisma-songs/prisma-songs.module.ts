import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaSongsController } from './prisma-songs.controller';
import { PrismaSongsService } from './prisma-songs.service';

/**
 * The Prisma rebuild of the songs feature (Project 9), served at
 * `/prisma/songs`. Compare with `SongsModule`: no `forFeature([...])`
 * registration and no `ArtistsModule` — `PrismaService` already exposes
 * every model, and artist lookup happens inside the song queries.
 */
@Module({
  imports: [PrismaModule],
  controllers: [PrismaSongsController],
  providers: [PrismaSongsService],
})
export class PrismaSongsModule {}

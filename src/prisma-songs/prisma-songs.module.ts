import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaSongsController } from './prisma-songs.controller';
import { PrismaSongsService } from './prisma-songs.service';

/**
 * The songs feature implemented with Prisma at `/prisma/songs`, for
 * comparison with the TypeORM `SongsModule`. No `forFeature` or
 * `ArtistsModule` needed: `PrismaService` exposes every model, and artists
 * are resolved inside the song queries.
 */
@Module({
  imports: [PrismaModule],
  controllers: [PrismaSongsController],
  providers: [PrismaSongsService],
})
export class PrismaSongsModule {}

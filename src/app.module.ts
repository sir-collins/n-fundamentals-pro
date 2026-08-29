import { Module, MiddlewareConsumer } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SongsController } from './songs/songs.controller';
import { SongsService } from './songs/songs.service';
import { LoggerMiddleware } from './common/middleware/logger/logger.middleware';

@Module({
  imports: [],
  controllers: [AppController, SongsController],
  providers: [AppService, SongsService],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('songs');
  }
}

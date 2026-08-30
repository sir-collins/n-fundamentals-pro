import { Module, MiddlewareConsumer } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SongsModule } from './songs/songs.module';
import { LoggerMiddleware } from './common/middleware/logger/logger.middleware';

@Module({
  imports: [
    // Opens the connection to the Postgres started via docker-compose.yml.
    // Credentials are hardcoded here for now — Project 4 in the roadmap
    // moves this to validated environment variables; not worth doing early.
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'nestjs',
      password: 'nestjs',
      database: 'n_fundamentals',
      entities: [],
      // Auto-creates/alters tables to match entities — convenient in dev,
      // unsafe in prod (can silently drop/alter columns). Migrations
      // (Project 4) replace this once schema changes need to be reviewable.
      synchronize: true,
    }),
    SongsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    // Scoped to songs routes only — no other resource needs it yet.
    consumer.apply(LoggerMiddleware).forRoutes('songs');
  }
}

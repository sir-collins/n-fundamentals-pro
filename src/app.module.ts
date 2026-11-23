import { join } from 'path';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { MongooseModule } from '@nestjs/mongoose';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { SongsModule } from './songs/songs.module';
import { Song } from './songs/entities/song.entity';
import { Artist } from './artists/entities/artist.entity';
import { AuthModule } from './auth/auth.module';
import { User } from './users/entities/user.entity';
import { ApiKey } from './auth/entities/api-key.entity';
import { CommentsModule } from './comments/comments.module';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { ArtistsModule } from './artists/artists.module';
import { ArtistsService } from './artists/artists.service';
import {
  createArtistProfileLoader,
  createArtistsBySongLoader,
} from './artists/artists.loader';
import { DeezerService } from './artists/deezer.service';
import { GqlContext } from './common/graphql-context';
import { cacheControlDirective } from './common/cache-control';
import responseCachePlugin from '@apollo/server-plugin-response-cache';
import { envValidationSchema } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { PrismaSongsModule } from './prisma-songs/prisma-songs.module';
import { MailModule } from './mail/mail.module';
import { PrismaRelationsModule } from './prisma-relations/prisma-relations.module';
import { HealthModule } from './health/health.module';
import { RootController } from './root.controller';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppThrottlerGuard } from './common/guards/app-throttler.guard';

@Module({
  imports: [
    // A missing or malformed env var stops the app at boot.
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.getOrThrow<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.getOrThrow<string>('DB_USERNAME'),
        password: configService.getOrThrow<string>('DB_PASSWORD'),
        database: configService.getOrThrow<string>('DB_NAME'),
        entities: [Song, Artist, User, ApiKey],
        // Schema changes go through committed migrations (see
        // src/database/), and no migrationsRun: applying one is an
        // explicit step, not part of startup.
        synchronize: false,
      }),
    }),
    // Comments only; see comments/schemas/comment.schema.ts.
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.getOrThrow<string>('MONGO_URI'),
      }),
    }),
    // Code-first. schema.gql is committed so schema changes show up in
    // PR diffs.
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      imports: [ArtistsModule],
      inject: [ArtistsService, DeezerService],
      useFactory: (
        artistsService: ArtistsService,
        deezerService: DeezerService,
      ) => ({
        autoSchemaFile: join(process.cwd(), 'schema.gql'),
        sortSchema: true,
        // Needed for CommentsResolver's subscription.
        subscriptions: { 'graphql-ws': true },
        // Caches whole query results in memory, per process, for as long
        // as the response's cache hints allow (see common/cache-control.ts).
        plugins: [responseCachePlugin()],
        buildSchemaOptions: { directives: [cacheControlDirective] },
        // Nest skips enhancers on @ResolveField unless listed here. Without
        // 'filters', a field resolver's HttpException (e.g. Artist.profile's
        // BadGatewayException) bypasses AllExceptionsFilter and reaches
        // clients as INTERNAL_SERVER_ERROR. Only filters: each enhancer
        // adds per-field overhead.
        fieldResolverEnhancers: ['filters'],
        // Runs per operation, so each request gets fresh DataLoaders (a
        // shared one would serve stale cached results). Preferred over a
        // `Scope.REQUEST` provider, which would make every injecting
        // resolver request-scoped. GqlAuthGuard reads `req`. Subscriptions
        // call this without a `req`; they never use the loaders.
        context: ({ req }: { req: GqlContext['req'] }): GqlContext => ({
          req,
          loaders: {
            artistsBySong: createArtistsBySongLoader(artistsService),
            artistProfile: createArtistProfileLoader(deezerService),
          },
        }),
      }),
    }),
    SongsModule,
    AuthModule,
    CommentsModule,
    // Prisma alongside TypeORM, in its own Postgres schema ("prisma"),
    // serving the /prisma/* routes.
    PrismaModule,
    PrismaSongsModule,
    PrismaRelationsModule,
    // In-process and not durable: an event emitted just before a crash is
    // lost, so it's only for side effects that can tolerate that.
    EventEmitterModule.forRoot(),
    // Without it @Cron methods are silently inert: no error, the jobs just
    // never run (the E2E suite checks the job is registered).
    ScheduleModule.forRoot(),
    MailModule,
    HealthModule,
    // 100 requests per client IP per minute by default; routes that check
    // a password or TOTP code use the stricter `@AuthThrottle()`. Off under
    // Jest (NODE_ENV=test), where every request comes from one IP; the
    // throttling E2E suite turns it back on.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [{ ttl: 60_000, limit: 100 }],
        skipIf: () => config.get<string>('NODE_ENV') === 'test',
      }),
    }),
  ],
  controllers: [RootController],
  providers: [{ provide: APP_GUARD, useClass: AppThrottlerGuard }],
})
export class AppModule implements NestModule {
  constructor(private readonly config: ConfigService) {}

  configure(consumer: MiddlewareConsumer) {
    // Jest sets NODE_ENV=test; a line per request would bury test output.
    if (this.config.get<string>('NODE_ENV') !== 'test') {
      consumer.apply(LoggerMiddleware).forRoutes('{*splat}');
    }
  }
}

import { join } from 'path';
import { Module, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MongooseModule } from '@nestjs/mongoose';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SongsModule } from './songs/songs.module';
import { Song } from './songs/entities/song.entity';
import { Artist } from './artists/entities/artist.entity';
import { AuthModule } from './auth/auth.module';
import { User } from './users/entities/user.entity';
import { ApiKey } from './auth/entities/api-key.entity';
import { CommentsModule } from './comments/comments.module';
import { LoggerMiddleware } from './common/middleware/logger/logger.middleware';
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

@Module({
  imports: [
    // isGlobal: true so ConfigService is injectable anywhere (AuthModule,
    // JwtStrategy) without re-importing ConfigModule per module.
    // validationSchema means a missing/malformed required env var makes
    // the app refuse to boot, rather than silently running with undefined.
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),
    // Opens the connection to the Postgres started via docker-compose.yml.
    // Connection values now come from validated env vars (see
    // src/config/env.validation.ts) instead of hardcoded literals.
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
        // Schema changes now go through explicit, committed migrations
        // (npm run migration:generate/run/revert — see
        // src/database/data-source.ts and src/database/migrations/)
        // instead of auto-syncing on every boot. Deliberately no
        // migrationsRun here either — running a migration stays a
        // conscious step, not something that happens silently at startup.
        synchronize: false,
      }),
    }),
    // The polyglot-persistence piece: comments live in Mongo (via
    // docker-compose.yml's mongo service) instead of Postgres — a
    // schema-flexible store fits user-generated content better than a
    // migration for every shape change. No `entities`/`synchronize`
    // equivalent here — Mongoose schemas register per-module via
    // `MongooseModule.forFeature(...)` (see comments.module.ts).
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.getOrThrow<string>('MONGO_URI'),
      }),
    }),
    // A second, parallel API layer over the same domain/services as the
    // REST controllers — code-first: types/inputs come from decorators
    // already on existing classes (Song, CreateSongDto, ...), not a
    // hand-written schema. autoSchemaFile writes the generated schema to
    // a real, committed file (not gitignored) so schema changes show up
    // as a visible diff in PRs, same as every other generated-but-tracked
    // artifact in this project (migrations, railway.json).
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
        // Enables the `graphql-ws` protocol so `@Subscription()` resolvers
        // (CommentsResolver) work — the transport package itself
        // (graphql-ws) is already a dependency of @nestjs/graphql, not
        // something this project had to add.
        subscriptions: { 'graphql-ws': true },
        // Caches whole query results in memory, per process, for as long
        // as the response's cache hints allow (see common/cache-control.ts).
        plugins: [responseCachePlugin()],
        buildSchemaOptions: { directives: [cacheControlDirective] },
        // Nest skips guards/interceptors/filters on @ResolveField resolvers
        // unless listed here — without 'filters', a field resolver's
        // HttpException (e.g. Artist.profile's BadGatewayException) bypasses
        // HttpExceptionFilter and reaches clients as a bare
        // INTERNAL_SERVER_ERROR. Filters only: guards and interceptors
        // aren't needed per field, and each enhancer listed adds per-field
        // overhead.
        fieldResolverEnhancers: ['filters'],
        // Runs once per operation, so every request gets fresh DataLoaders
        // (a shared one would keep serving stale cached results). Chosen
        // over a `Scope.REQUEST` provider, which would make every resolver
        // injecting it request-scoped too. `req` must stay: GqlAuthGuard
        // and AuthResolver.profile read it. Subscriptions call this too,
        // without a `req` — harmless, they never use the loaders.
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

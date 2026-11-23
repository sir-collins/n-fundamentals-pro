import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { configureApp } from './configure-app';

// Set only under webpack (start:hmr). Typed narrowly rather than `any` to
// satisfy the no-unsafe-* ESLint rules.
declare const module: {
  hot?: {
    accept(): void;
    dispose(callback: () => void): void;
  };
};

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);
  app.enableShutdownHooks();

  const configService = app.get(ConfigService);
  const isProduction = configService.get<string>('NODE_ENV') === 'production';

  // CSP only in production: Swagger UI, the Apollo landing page and the
  // demo pages in public/ rely on inline or CDN scripts.
  app.use(helmet({ contentSecurityPolicy: isProduction ? undefined : false }));

  const corsOrigin = configService.get<string>('CORS_ORIGIN');
  if (corsOrigin) {
    app.enableCors({
      origin: corsOrigin.split(',').map((origin) => origin.trim()),
    });
  }

  // The WebSocket and GraphQL-subscription demo pages.
  app.useStaticAssets(join(__dirname, '..', 'public'));

  // Its own flag rather than tied to NODE_ENV. Defaults to on (see
  // env.validation.ts); set ENABLE_SWAGGER=false to hide the docs.
  if (configService.get<boolean>('ENABLE_SWAGGER')) {
    // Scheme names must match the decorators: addBearerAuth()'s default
    // 'bearer' for @ApiBearerAuth(), 'api-key' for @ApiSecurity('api-key').
    const swaggerDocument = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Music Catalog API')
        .setDescription(
          'Songs, artists, users and comments over REST, GraphQL and ' +
            'WebSockets, behind JWT auth with roles, 2FA and API keys. ' +
            'Routes under /prisma mirror the TypeORM ones on Prisma.',
        )
        .setVersion('1.0')
        .addBearerAuth()
        .addApiKey(
          { type: 'apiKey', name: 'x-api-key', in: 'header' },
          'api-key',
        )
        .build(),
    );
    SwaggerModule.setup('api', app, swaggerDocument);
  }

  // A PORT set in the shell overrides .env's.
  await app.listen(configService.get<number>('PORT') ?? 3000);

  // On a hot update, close this instance (and its DB connections) before
  // webpack re-runs bootstrap().
  if (module.hot) {
    module.hot.accept();
    module.hot.dispose(() => void app.close());
  }
}
void bootstrap();

import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

// Only ever populated when running under webpack (start:hmr) — narrowly
// typed instead of Nest's docs' `any` so this doesn't trip the project's
// no-unsafe-member-access/no-unsafe-call ESLint rules.
declare const module: {
  hot?: {
    accept(): void;
    dispose(callback: () => void): void;
  };
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Applied globally so every controller gets DTO validation and a
  // consistent error response shape without repeating the setup per route.
  // transform: true lets class-transformer convert raw query/param strings
  // (e.g. "2") into the DTO's declared types (e.g. number) before
  // class-validator runs — required for PaginationQueryDto to work.
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  const configService = app.get(ConfigService);
  // dotenv (under ConfigModule.forRoot) doesn't override a variable
  // already set in the shell environment, so `PORT=3001 npm run
  // start:dev` still wins over .env's PORT for scratch-port testing.
  await app.listen(configService.get<number>('PORT') ?? 3000);

  // Only defined when running under webpack (start:hmr) — under the normal
  // tsc build/start:dev this branch never runs. On a hot update, dispose()
  // closes this app instance (including the TypeORM connection) right
  // before webpack re-runs bootstrap() with the new code.
  if (module.hot) {
    module.hot.accept();
    module.hot.dispose(() => void app.close());
  }
}
bootstrap();

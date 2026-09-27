import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

/**
 * Global request-handling setup shared by `main.ts` and the E2E specs.
 * `Test.createTestingModule({ imports: [AppModule] })` builds the app from
 * `AppModule` alone and never runs `main.ts`, so anything registered only
 * there silently goes missing under test — E2E would exercise a different
 * app from the one that actually runs (no validation, raw error shapes).
 * Server-only concerns (static assets, Swagger, HMR) stay in `main.ts`.
 */
export function configureApp(app: INestApplication): void {
  // Applied globally so every controller/resolver gets DTO validation and a
  // consistent error response shape without repeating the setup per route.
  // transform: true lets class-transformer convert raw query/param strings
  // (e.g. "2") into the DTO's declared types (e.g. number) before
  // class-validator runs — required for PaginationQueryDto to work.
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
}

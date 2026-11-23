import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

/**
 * Global pipes and filters, shared by `main.ts` and the E2E specs. E2E
 * tests never run `main.ts`, so anything registered only there would be
 * missing under test. Server-only setup (Swagger, static files, HMR) stays
 * in `main.ts`.
 */
export function configureApp(app: INestApplication): void {
  // transform: true converts query strings to the DTO's types (needed by
  // PaginationQueryDto). whitelist: true strips undecorated properties;
  // otherwise an `id` in a song body would make TypeORM's save() overwrite
  // that row. Unknown fields are dropped rather than rejected.
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
}

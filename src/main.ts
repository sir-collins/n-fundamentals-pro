import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Applied globally so every controller gets DTO validation and a
  // consistent error response shape without repeating the setup per route.
  // transform: true lets class-transformer convert raw query/param strings
  // (e.g. "2") into the DTO's declared types (e.g. number) before
  // class-validator runs — required for PaginationQueryDto to work.
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

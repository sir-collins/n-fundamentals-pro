import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
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
  const configService = app.get(ConfigService);
  // dotenv (under ConfigModule.forRoot) doesn't override a variable
  // already set in the shell environment, so `PORT=3001 npm run
  // start:dev` still wins over .env's PORT for scratch-port testing.
  await app.listen(configService.get<number>('PORT') ?? 3000);
}
bootstrap();

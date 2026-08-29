import { Injectable, NestMiddleware } from '@nestjs/common';

/** Logs a line for every request to a route it's applied to. */
@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    console.log('Request ...', new Date().toDateString());
    next();
  }
}

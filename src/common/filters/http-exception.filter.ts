import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Catches every `HttpException` — ours and Nest's own (e.g. a failed
 * `ParseIntPipe`) — and formats it as a consistent
 * `{ statusCode, timestamp, path, message }` error response.
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // Nest's built-in exceptions (e.g. ParseIntPipe failures) return an
    // object with a `message` field; a plain `throw new NotFoundException('...')`
    // returns just the string.
    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : ((exceptionResponse as { message?: unknown }).message ??
          exception.message);

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    });
  }
}

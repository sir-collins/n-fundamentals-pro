import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { GqlContextType, GqlExceptionFilter } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { Request, Response } from 'express';

/**
 * The single global exception filter, for both REST and GraphQL.
 *
 * - `HttpException`s (ours and Nest's own, e.g. a failed `ParseIntPipe`)
 *   become `{ statusCode, timestamp, path, message }` over REST and a
 *   `GraphQLError` with `code`/`statusCode` extensions over GraphQL.
 * - Anything else over REST is a bug: it's logged with its stack and the
 *   client gets the same shape with a generic 500, so internals never leak.
 *   Controllers therefore don't wrap handlers in try/catch.
 * - Anything else over GraphQL (or another transport) is rethrown, leaving
 *   it to that transport's own error handling.
 *
 * One filter with a branch on `host.getType()`, not one filter per
 * transport: Nest picks the first matching global filter, so two
 * overlapping `@Catch()` filters would make the choice depend on
 * registration order. GraphQL also has no Express `Response` to write to,
 * so the REST path must never run there.
 */
@Catch()
export class AllExceptionsFilter
  implements ExceptionFilter, GqlExceptionFilter
{
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const type = host.getType<GqlContextType>();

    if (type === 'graphql') {
      if (exception instanceof HttpException) {
        return this.formatForGraphQL(exception);
      }
      throw exception;
    }

    if (type !== 'http') {
      throw exception;
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    if (!isHttpException) {
      this.logger.error(
        `${request.method} ${request.url} failed`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    // A streamed response (e.g. an avatar download) can fail after the
    // headers went out; all that's left to do then is end it.
    if (response.headersSent) {
      response.end();
      return;
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: isHttpException
        ? this.extractMessage(exception)
        : 'Internal server error',
    });
  }

  private formatForGraphQL(exception: HttpException): GraphQLError {
    const message = this.extractMessage(exception);

    return new GraphQLError(
      Array.isArray(message) ? message.join(', ') : message,
      {
        extensions: {
          code: exception.name,
          statusCode: exception.getStatus(),
        },
      },
    );
  }

  // Nest's built-in exceptions (e.g. ParseIntPipe failures, or a
  // class-validator failure) carry an object whose `message` may be an
  // array, one entry per failed rule; `new NotFoundException('...')`
  // carries just the string.
  private extractMessage(exception: HttpException): string | string[] {
    const exceptionResponse = exception.getResponse();

    return typeof exceptionResponse === 'string'
      ? exceptionResponse
      : ((exceptionResponse as { message?: string | string[] }).message ??
          exception.message);
  }
}

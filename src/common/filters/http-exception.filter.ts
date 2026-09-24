import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { GqlContextType, GqlExceptionFilter } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { Request, Response } from 'express';

/**
 * Catches every `HttpException` — ours and Nest's own (e.g. a failed
 * `ParseIntPipe`) — across *both* transports this app exposes, REST and
 * GraphQL, and formats it consistently for each.
 *
 * The two transports need genuinely different handling, not just a
 * different message format: REST exceptions go through Nest's
 * `ExceptionsHandler` and are expected to write directly to a real
 * Express `Response`; GraphQL resolvers go through a separate pathway
 * (`ExternalExceptionsHandler`) where no such response object exists —
 * calling `.status()` on it throws a second, unhandled error. Confirmed
 * by reading `@nestjs/core`'s exception-handling source directly, not
 * assumed.
 *
 * Deliberately **one filter with a branch**, not two separate filters
 * (one global + one GraphQL-specific). Also confirmed from that same
 * source read: Nest resolves `@Catch()` filters via `Array.find()` over
 * `[...method, ...class, ...global]` (global filters checked *last*) —
 * two globally-registered filters both `@Catch(HttpException)` would
 * create real ambiguity over which one actually handles a given
 * exception. Branching on `host.getType()` here avoids that ambiguity
 * entirely rather than working around it.
 */
@Catch(HttpException)
export class HttpExceptionFilter
  implements ExceptionFilter, GqlExceptionFilter
{
  catch(exception: HttpException, host: ArgumentsHost) {
    if (host.getType<GqlContextType>() === 'graphql') {
      return this.formatForGraphQL(exception);
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: this.extractMessage(exception),
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
  // class-validator failure on a GraphQL input) return an object with a
  // `message` field (sometimes an array, one entry per failed
  // validation rule); a plain `throw new NotFoundException('...')`
  // returns just the string.
  private extractMessage(exception: HttpException): string | string[] {
    const exceptionResponse = exception.getResponse();

    return typeof exceptionResponse === 'string'
      ? exceptionResponse
      : ((exceptionResponse as { message?: string | string[] }).message ??
          exception.message);
  }
}

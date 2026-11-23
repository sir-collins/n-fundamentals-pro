import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { ArgumentsHost, Logger, NotFoundException } from '@nestjs/common';
import { GraphQLError } from 'graphql';
import { AllExceptionsFilter } from './all-exceptions.filter';

function httpHost(headersSent = false) {
  const response = {
    headersSent,
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    end: jest.fn(),
  };
  const request = { method: 'GET', url: '/songs/1' };
  const host = {
    getType: () => 'http',
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
  return { host, response };
}

const graphqlHost = { getType: () => 'graphql' } as unknown as ArgumentsHost;

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('formats an HttpException with its own status and message', () => {
    const { host, response } = httpHost();

    filter.catch(new NotFoundException('Song with id 1 was not found'), host);

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        path: '/songs/1',
        message: 'Song with id 1 was not found',
      }),
    );
  });

  it('logs an unknown error and returns a generic 500', () => {
    const log = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const { host, response } = httpHost();

    filter.catch(new Error('connection refused'), host);

    expect(log).toHaveBeenCalledWith(
      'GET /songs/1 failed',
      expect.stringContaining('connection refused'),
    );
    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        message: 'Internal server error',
      }),
    );
  });

  it('only ends the response if headers were already sent', () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { host, response } = httpHost(true);

    filter.catch(new Error('stream broke'), host);

    expect(response.end).toHaveBeenCalled();
    expect(response.json).not.toHaveBeenCalled();
  });

  it('turns an HttpException into a GraphQLError over GraphQL', () => {
    const result = filter.catch(new NotFoundException('nope'), graphqlHost);

    expect(result).toBeInstanceOf(GraphQLError);
    expect((result as GraphQLError).extensions).toEqual({
      code: 'NotFoundException',
      statusCode: 404,
    });
  });

  it('rethrows an unknown error over GraphQL', () => {
    const error = new Error('boom');

    expect(() => filter.catch(error, graphqlHost)).toThrow(error);
  });
});

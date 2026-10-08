import { createMock } from '@golevelup/nestjs-testing';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { BadGatewayException, GatewayTimeoutException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeezerService } from './deezer.service';

// `fetch` is replaced for every test — no request ever reaches Deezer.
describe('DeezerService', () => {
  let service: DeezerService;
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  const weeknd = {
    id: 4050205,
    name: 'The Weeknd',
    link: 'https://www.deezer.com/artist/4050205',
    picture_medium: 'https://cdn.example/weeknd.jpg',
    nb_album: 86,
    nb_fan: 14726852,
  };

  function respondWith(body: unknown, status = 200): void {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    );
  }

  beforeEach(() => {
    const configService = createMock<ConfigService>();
    configService.getOrThrow.mockReturnValue('https://deezer.test');
    service = new DeezerService(configService);
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('maps an exactly-matching artist onto ArtistProfile', async () => {
    respondWith({ data: [weeknd] });

    expect(await service.findArtistProfile('The Weeknd')).toEqual({
      deezerId: 4050205,
      link: 'https://www.deezer.com/artist/4050205',
      pictureUrl: 'https://cdn.example/weeknd.jpg',
      fans: 14726852,
      albums: 86,
    });
  });

  it('matches names case-insensitively', async () => {
    respondWith({ data: [weeknd] });

    expect(await service.findArtistProfile('the weeknd')).toMatchObject({
      deezerId: 4050205,
    });
  });

  it('skips a non-matching first result for the first exact match', async () => {
    respondWith({
      data: [{ ...weeknd, id: 1, name: 'The Weeknd Tribute Band' }, weeknd],
    });

    expect(await service.findArtistProfile('The Weeknd')).toMatchObject({
      deezerId: 4050205,
    });
  });

  it('returns null when no result matches the name exactly', async () => {
    respondWith({ data: [{ ...weeknd, name: 'Someone Else' }] });

    expect(await service.findArtistProfile('The Weeknd')).toBeNull();
  });

  it('returns null when Deezer finds nothing', async () => {
    respondWith({ data: [], total: 0 });

    expect(await service.findArtistProfile('Nobody')).toBeNull();
  });

  it('throws BadGatewayException on an HTTP error status', async () => {
    respondWith({}, 500);

    await expect(service.findArtistProfile('The Weeknd')).rejects.toThrow(
      BadGatewayException,
    );
  });

  it('throws BadGatewayException on an error body sent with HTTP 200', async () => {
    // How Deezer actually reports API errors — status alone isn't enough.
    respondWith({
      error: { type: 'InvalidQueryException', message: 'bad', code: 600 },
    });

    await expect(service.findArtistProfile('The Weeknd')).rejects.toThrow(
      BadGatewayException,
    );
  });

  it('throws BadGatewayException when Deezer cannot be reached', async () => {
    fetchSpy.mockRejectedValue(new TypeError('fetch failed'));

    await expect(service.findArtistProfile('The Weeknd')).rejects.toThrow(
      BadGatewayException,
    );
  });

  it('throws GatewayTimeoutException when Deezer is too slow', async () => {
    fetchSpy.mockRejectedValue(
      new DOMException('The operation timed out.', 'TimeoutError'),
    );

    await expect(service.findArtistProfile('The Weeknd')).rejects.toThrow(
      GatewayTimeoutException,
    );
  });

  it('encodes the name into the URL and sets a timeout signal', async () => {
    respondWith({ data: [] });

    await service.findArtistProfile('AC/DC & Friends');

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(
      'https://deezer.test/search/artist?q=AC%2FDC%20%26%20Friends&limit=5',
    );
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });
});

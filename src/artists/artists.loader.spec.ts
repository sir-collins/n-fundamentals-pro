import { createMock, DeepMocked } from '@golevelup/nestjs-testing';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { BadGatewayException } from '@nestjs/common';
import {
  createArtistProfileLoader,
  createArtistsBySongLoader,
} from './artists.loader';
import { DeezerService } from './deezer.service';
import { ArtistProfile } from './dto/artist-profile.type';
import { ArtistsService } from './artists.service';
import { Artist } from './entities/artist.entity';

describe('createArtistsBySongLoader', () => {
  let artistsService: DeepMocked<ArtistsService>;

  const weeknd = { id: 1, name: 'The Weeknd' } as Artist;
  const daftPunk = { id: 2, name: 'Daft Punk' } as Artist;

  beforeEach(() => {
    artistsService = createMock<ArtistsService>();
  });

  it('batches loads made in the same tick into one query', async () => {
    artistsService.findBySongIds.mockResolvedValue(new Map());
    const loader = createArtistsBySongLoader(artistsService);

    await Promise.all([loader.load(1), loader.load(2), loader.load(3)]);

    expect(artistsService.findBySongIds).toHaveBeenCalledTimes(1);
    expect(artistsService.findBySongIds).toHaveBeenCalledWith([1, 2, 3]);
  });

  it('returns results in key order, whatever order the query produced', async () => {
    // Deliberately built in the opposite order to the keys requested.
    artistsService.findBySongIds.mockResolvedValue(
      new Map([
        [2, [daftPunk]],
        [1, [weeknd]],
      ]),
    );
    const loader = createArtistsBySongLoader(artistsService);

    const [song1, song2] = await Promise.all([loader.load(1), loader.load(2)]);

    expect(song1).toEqual([weeknd]);
    expect(song2).toEqual([daftPunk]);
  });

  it('gives a song with no artists an empty list rather than a missing slot', async () => {
    artistsService.findBySongIds.mockResolvedValue(new Map([[1, [weeknd]]]));
    const loader = createArtistsBySongLoader(artistsService);

    const [song1, song99] = await Promise.all([
      loader.load(1),
      loader.load(99),
    ]);

    expect(song1).toEqual([weeknd]);
    expect(song99).toEqual([]);
  });

  it('caches per loader: loading the same song twice queries once', async () => {
    artistsService.findBySongIds.mockResolvedValue(new Map([[1, [weeknd]]]));
    const loader = createArtistsBySongLoader(artistsService);

    await loader.load(1);
    await loader.load(1);

    expect(artistsService.findBySongIds).toHaveBeenCalledTimes(1);
  });
});

describe('createArtistProfileLoader', () => {
  let deezerService: DeepMocked<DeezerService>;

  const profile = { deezerId: 1, fans: 10 } as ArtistProfile;

  beforeEach(() => {
    deezerService = createMock<DeezerService>();
  });

  it('calls Deezer once per distinct name, however often it is requested', async () => {
    deezerService.findArtistProfile.mockResolvedValue(profile);
    const loader = createArtistProfileLoader(deezerService);

    // e.g. one artist appearing on three songs in the same response.
    await Promise.all([
      loader.load('The Weeknd'),
      loader.load('The Weeknd'),
      loader.load('The Weeknd'),
      loader.load('Daft Punk'),
    ]);

    expect(deezerService.findArtistProfile).toHaveBeenCalledTimes(2);
    expect(deezerService.findArtistProfile).toHaveBeenCalledWith('The Weeknd');
    expect(deezerService.findArtistProfile).toHaveBeenCalledWith('Daft Punk');
  });

  it('fails only the key whose lookup failed, not the whole batch', async () => {
    deezerService.findArtistProfile.mockImplementation((name) =>
      name === 'Broken'
        ? Promise.reject(new BadGatewayException('Deezer error'))
        : Promise.resolve(profile),
    );
    const loader = createArtistProfileLoader(deezerService);

    const [ok, broken] = await Promise.allSettled([
      loader.load('The Weeknd'),
      loader.load('Broken'),
    ]);

    expect(ok).toEqual({ status: 'fulfilled', value: profile });
    expect(broken).toMatchObject({ status: 'rejected' });
    expect((broken as PromiseRejectedResult).reason).toBeInstanceOf(
      BadGatewayException,
    );
  });
});

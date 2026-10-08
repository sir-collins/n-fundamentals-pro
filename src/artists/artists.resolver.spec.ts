import { createMock } from '@golevelup/nestjs-testing';
import { describe, expect, it } from '@jest/globals';
import DataLoader from 'dataloader';
import { ArtistsResolver } from './artists.resolver';
import { Artist } from './entities/artist.entity';
import { ArtistProfile } from './dto/artist-profile.type';
import { GqlContext } from '../common/graphql-context';

describe('ArtistsResolver', () => {
  const resolver = new ArtistsResolver();

  describe('profile (field)', () => {
    function contextWith(
      loader: DataLoader<string, ArtistProfile | null>,
    ): GqlContext {
      return { loaders: { artistProfile: loader } } as GqlContext;
    }

    it("loads the profile through the request's DataLoader by artist name", async () => {
      const profile = { deezerId: 1 } as ArtistProfile;
      const loader = createMock<DataLoader<string, ArtistProfile | null>>();
      loader.load.mockResolvedValue(profile);

      expect(
        await resolver.profile(
          { id: 7, name: 'The Weeknd' } as Artist,
          contextWith(loader),
        ),
      ).toBe(profile);
      expect(loader.load).toHaveBeenCalledWith('The Weeknd');
    });
  });
});

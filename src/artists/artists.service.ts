import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Artist } from './entities/artist.entity';

/**
 * Resolves artist *names* (as sent by clients) to real `Artist` rows,
 * creating them the first time a name is seen. Keeps `SongsService` from
 * needing to know how artist identity/uniqueness works.
 */
@Injectable()
export class ArtistsService {
  constructor(
    @InjectRepository(Artist)
    private readonly artistsRepository: Repository<Artist>,
  ) {}

  /**
   * Find an existing Artist for each name, creating any that don't exist
   * yet.
   * @returns one Artist per unique name in `names` (order not guaranteed).
   */
  async findOrCreateMany(names: string[]): Promise<Artist[]> {
    // Dedupe the input first — without this, two new names that are the
    // same string would both try to insert a row with that name and hit
    // the unique constraint.
    const uniqueNames = [...new Set(names)];

    const existing = await this.artistsRepository.findBy({
      name: In(uniqueNames),
    });
    const existingNames = new Set(existing.map((artist) => artist.name));
    const newNames = uniqueNames.filter((name) => !existingNames.has(name));

    if (newNames.length === 0) {
      return existing;
    }

    const created = await this.artistsRepository.save(
      newNames.map((name) => this.artistsRepository.create({ name })),
    );

    return [...existing, ...created];
  }
}

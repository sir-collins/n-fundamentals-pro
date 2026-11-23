import { randomUUID } from 'crypto';
import { mkdir, rm, writeFile } from 'fs/promises';
import { basename, join, resolve } from 'path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Keeps avatar files on local disk under `<UPLOADS_DIR>/avatars`.
 *
 * Filenames are always generated here (`<userId>-<uuid>.<ext>`), never
 * taken from the client: a client filename like `../../.env` would be a
 * path-traversal attack.
 *
 * Local disk only works where the disk survives: Railway's is wiped on
 * every deploy. Production would need object storage (S3, R2) or a volume.
 */
@Injectable()
export class AvatarStorageService {
  private readonly dir: string;

  constructor(configService: ConfigService) {
    this.dir = resolve(
      configService.getOrThrow<string>('UPLOADS_DIR'),
      'avatars',
    );
  }

  /**
   * Write `buffer` under a newly generated name.
   * @returns the generated filename (what goes in `User.avatarPath`).
   */
  async save(userId: number, buffer: Buffer, ext: string): Promise<string> {
    const filename = `${userId}-${randomUUID()}.${ext}`;
    await mkdir(this.dir, { recursive: true });
    await writeFile(join(this.dir, filename), buffer);
    return filename;
  }

  /** Delete a stored file. A file that's already gone isn't an error. */
  async remove(filename: string): Promise<void> {
    await rm(this.pathFor(filename), { force: true });
  }

  /**
   * Absolute path of a stored file. `basename` keeps it inside the avatars
   * directory even if a stored value were ever tampered with.
   */
  pathFor(filename: string): string {
    return join(this.dir, basename(filename));
  }
}

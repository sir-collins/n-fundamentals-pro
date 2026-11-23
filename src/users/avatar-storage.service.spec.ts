import { mkdtemp, readFile, readdir, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { AvatarStorageService } from './avatar-storage.service';

// A real temp directory, not a mocked fs: what matters is what lands on disk.
describe('AvatarStorageService', () => {
  let root: string;
  let storage: AvatarStorageService;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'avatars-'));
    storage = new AvatarStorageService(
      new ConfigService({ UPLOADS_DIR: root }),
    );
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('writes the bytes under a generated <userId>-<uuid>.<ext> name', async () => {
    const filename = await storage.save(7, Buffer.from('bytes'), 'png');

    expect(filename).toMatch(/^7-[0-9a-f-]{36}\.png$/);
    expect(storage.pathFor(filename)).toBe(join(root, 'avatars', filename));
    expect(await readFile(storage.pathFor(filename), 'utf8')).toBe('bytes');
  });

  it('gives each save a new name', async () => {
    const a = await storage.save(7, Buffer.from('a'), 'png');
    const b = await storage.save(7, Buffer.from('b'), 'png');

    expect(a).not.toBe(b);
  });

  it('removes a file, and tolerates one that is already gone', async () => {
    const filename = await storage.save(7, Buffer.from('bytes'), 'png');

    await storage.remove(filename);
    await storage.remove(filename);

    expect(await readdir(join(root, 'avatars'))).toEqual([]);
  });

  it('keeps paths inside the avatars directory', () => {
    expect(storage.pathFor('../../.env')).toBe(join(root, 'avatars', '.env'));
  });
});

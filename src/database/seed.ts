import { NestFactory } from '@nestjs/core';
import { ConflictException, Logger } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppModule } from '../app.module';
import { UsersService } from '../users/users.service';
import { SongsService } from '../songs/songs.service';
import { User, UserRole } from '../users/entities/user.entity';

const logger = new Logger('Seed');

/**
 * Populates a fresh database with a couple of demo rows, so a new clone
 * isn't a totally empty app. Boots the full Nest DI container (no HTTP
 * listener) via `createApplicationContext`, so seeding goes through the
 * same services/validation the app itself uses — never raw SQL inserts
 * that would bypass password hashing or duplicate-email checks.
 *
 * Safe to run more than once: a user that already exists is skipped
 * (logged, not a crash) rather than failing the whole script.
 */
async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const usersService = app.get(UsersService);
  const songsService = app.get(SongsService);
  // UsersService.create deliberately has no `role` parameter at all — see
  // its own doc comment — so a demo admin account is promoted the same
  // way rest-client.http documents doing it for a real account: a direct,
  // out-of-band repository write, never a change to UsersService's own
  // signup contract.
  const usersRepository = app.get<Repository<User>>(getRepositoryToken(User));

  await createUser(usersService, 'admin@example.com', 'correcthorsebattery');
  const adminUser = await usersService.findByEmail('admin@example.com');
  if (adminUser) {
    await usersRepository.update(adminUser.id, { role: UserRole.ADMIN });
  }

  await createUser(usersService, 'demo@example.com', 'correcthorsebattery');

  await songsService.create({
    title: 'Blinding Lights',
    artists: ['The Weeknd'],
    releaseDate: '2019-11-29',
    duration: '00:03',
  });

  logger.log('Seeding complete.');
  await app.close();
  process.exit(0);
}

async function createUser(
  usersService: UsersService,
  email: string,
  password: string,
): Promise<void> {
  try {
    await usersService.create(email, password);
    logger.log(`Created user ${email}`);
  } catch (error) {
    if (error instanceof ConflictException) {
      logger.log(`User ${email} already exists, skipping`);
      return;
    }
    throw error;
  }
}

seed().catch((error: unknown) => {
  logger.error('Seeding failed', error instanceof Error ? error.stack : error);
  process.exit(1);
});

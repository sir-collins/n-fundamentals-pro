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
 * Seeds demo users and a song. Goes through the app's own services (via
 * `createApplicationContext`) so passwords are hashed as in normal signup.
 * Safe to re-run: existing users are skipped.
 */
async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const usersService = app.get(UsersService);
  const songsService = app.get(SongsService);
  // UsersService.create has no `role` parameter by design, so the admin is
  // promoted with a direct repository write.
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

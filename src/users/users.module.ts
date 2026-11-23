import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AvatarStorageService } from './avatar-storage.service';

/**
 * No controller — users aren't managed directly via their own REST
 * surface yet. Exports `UsersService` so `AuthModule` (and later,
 * anything else that needs user lookups) can use it.
 */
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService, AvatarStorageService],
  exports: [UsersService],
})
export class UsersModule {}

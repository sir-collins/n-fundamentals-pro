import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AvatarStorageService } from './avatar-storage.service';

/** Exports `UsersService` for `AuthModule` and other user lookups. */
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService, AvatarStorageService],
  exports: [UsersService],
})
export class UsersModule {}

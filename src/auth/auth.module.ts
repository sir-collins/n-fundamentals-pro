import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ApiKeysService } from './api-keys.service';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { ApiKey } from './entities/api-key.entity';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    // Secret now comes from validated env config (src/config/env.validation.ts)
    // instead of a hardcoded literal — JwtStrategy reads the same
    // JWT_SECRET via its own injected ConfigService, so signing and
    // verifying still can't silently drift onto different values.
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '1h' },
      }),
    }),
    TypeOrmModule.forFeature([ApiKey]),
  ],
  controllers: [AuthController],
  providers: [AuthService, LocalStrategy, JwtStrategy, ApiKeysService],
})
export class AuthModule {}

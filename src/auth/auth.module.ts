import { Module } from '@nestjs/common';
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

// Hardcoded placeholder secret — fine for local dev, but explicitly NOT
// safe to deploy with: this repo is public, and anyone with this string
// could forge a valid token for any user. Same precedent as the hardcoded
// Postgres credentials in app.module.ts, but this one carries a real risk
// if it were ever reused outside a dev machine. Project 4's validated
// env-var config step replaces both for real.
//
// Exported as a single constant, rather than repeated as a literal in both
// JwtModule.register() below and JwtStrategy's own config, so the two
// can't silently drift apart into signing with one value and verifying
// with another.
export const JWT_SECRET = 'CHANGE_ME_DEV_ONLY_SECRET';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.register({
      secret: JWT_SECRET,
      signOptions: { expiresIn: '1h' },
    }),
    TypeOrmModule.forFeature([ApiKey]),
  ],
  controllers: [AuthController],
  providers: [AuthService, LocalStrategy, JwtStrategy, ApiKeysService],
})
export class AuthModule {}

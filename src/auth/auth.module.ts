import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LocalStrategy } from './strategies/local.strategy';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    // Hardcoded placeholder secret — fine for local dev, but explicitly
    // NOT safe to deploy with: this repo is public, and anyone with this
    // string could forge a valid token for any user. Same precedent as the
    // hardcoded Postgres credentials in app.module.ts, but this one
    // carries a real risk if it were ever reused outside a dev machine.
    // Project 4's validated env-var config step replaces both for real.
    JwtModule.register({
      secret: 'CHANGE_ME_DEV_ONLY_SECRET',
      signOptions: { expiresIn: '1h' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, LocalStrategy],
})
export class AuthModule {}

import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthResolver } from './auth.resolver';
import { ApiKeysService } from './api-keys.service';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { ApiKey } from './entities/api-key.entity';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    // JwtStrategy reads the same JWT_SECRET, so signing and verifying
    // can't drift onto different values.
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
  providers: [
    AuthService,
    AuthResolver,
    LocalStrategy,
    JwtStrategy,
    ApiKeysService,
  ],
})
export class AuthModule {}

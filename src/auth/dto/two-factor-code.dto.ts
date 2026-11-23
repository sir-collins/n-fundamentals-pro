import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

/** Body of `POST /auth/2fa/turn-on`. */
export class TwoFactorCodeDto {
  // otplib's default TOTP codes are 6 digits.
  @ApiProperty({ minLength: 6, maxLength: 6, example: '123456' })
  @IsString()
  @Length(6, 6)
  readonly code!: string;
}

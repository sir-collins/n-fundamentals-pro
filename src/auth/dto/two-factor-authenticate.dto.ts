import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

/** Body of `POST /auth/2fa/authenticate`. */
export class TwoFactorAuthenticateDto {
  // Proof the password check succeeded; not usable as an access token.
  @ApiProperty({
    description: 'The tempToken returned by login when 2FA is enabled',
  })
  @IsString()
  readonly tempToken!: string;

  // otplib's default TOTP codes are 6 digits.
  @ApiProperty({ minLength: 6, maxLength: 6, example: '123456' })
  @IsString()
  @Length(6, 6)
  readonly code!: string;
}

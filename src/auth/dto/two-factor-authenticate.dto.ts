import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

/** Validated shape of a `POST /auth/2fa/authenticate` request body. */
export class TwoFactorAuthenticateDto {
  // The short-lived token login returned when it saw isTwoFactorEnabled —
  // this is the proof the password check already succeeded, not a real
  // access token itself.
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

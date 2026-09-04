import { IsString, Length } from 'class-validator';

/** Validated shape of a `POST /auth/2fa/authenticate` request body. */
export class TwoFactorAuthenticateDto {
  // The short-lived token login returned when it saw isTwoFactorEnabled —
  // this is the proof the password check already succeeded, not a real
  // access token itself.
  @IsString()
  readonly tempToken!: string;

  // otplib's default TOTP codes are 6 digits.
  @IsString()
  @Length(6, 6)
  readonly code!: string;
}

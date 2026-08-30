import { IsEmail, IsString, MinLength } from 'class-validator';

/** Validated shape of an incoming `POST /auth/signup` request body. */
export class SignupDto {
  @IsEmail()
  readonly email!: string;

  // bcrypt itself has no minimum length — this floor just rejects
  // trivially weak passwords before they're ever hashed.
  @IsString()
  @MinLength(8)
  readonly password!: string;
}

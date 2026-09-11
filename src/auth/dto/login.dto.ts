import { ApiProperty } from '@nestjs/swagger';

/**
 * Doc-only shape of `POST /auth/login`'s request body — Passport's
 * `LocalStrategy` reads `email`/`password` off the request directly
 * (`login()` has no `@Body()` param), so there's nothing for Swagger to
 * infer a body from without this. Never used for actual validation.
 */
export class LoginDto {
  @ApiProperty()
  readonly email!: string;

  @ApiProperty()
  readonly password!: string;
}

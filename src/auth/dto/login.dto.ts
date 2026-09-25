import { ApiProperty } from '@nestjs/swagger';
import { Field, InputType } from '@nestjs/graphql';
import { IsEmail, IsString } from 'class-validator';

/**
 * `POST /auth/login`'s request body, for Swagger's benefit only —
 * Passport's `LocalStrategy` reads `email`/`password` off the REST
 * request directly (`login()` has no `@Body()` param), so
 * `class-validator` here never runs for REST.
 *
 * It does run for GraphQL's `login` mutation, though (`@InputType()`,
 * used directly as that resolver's input) — there's no Passport
 * strategy in the way there, so this DTO is this app's only real
 * validation for a GraphQL login attempt.
 */
@InputType()
export class LoginDto {
  @ApiProperty()
  @Field()
  @IsEmail()
  readonly email!: string;

  @ApiProperty()
  @Field()
  @IsString()
  readonly password!: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { Field, InputType } from '@nestjs/graphql';
import { IsEmail, IsString, MinLength } from 'class-validator';

/**
 * Validated shape of an incoming `POST /auth/signup` request body —
 * also used directly as GraphQL's `signup` mutation input
 * (`@InputType()`), so both transports share the exact same validation.
 */
@InputType()
export class SignupDto {
  @ApiProperty()
  @Field()
  @IsEmail()
  readonly email!: string;

  // bcrypt itself has no minimum length — this floor just rejects
  // trivially weak passwords before they're ever hashed.
  @ApiProperty({ minLength: 8 })
  @Field()
  @IsString()
  @MinLength(8)
  readonly password!: string;
}

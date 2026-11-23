import { ApiProperty } from '@nestjs/swagger';
import { Field, InputType } from '@nestjs/graphql';
import { IsEmail, IsString, MinLength } from 'class-validator';

/** Signup input, shared by `POST /auth/signup` and the GraphQL mutation. */
@InputType()
export class SignupDto {
  @ApiProperty()
  @Field()
  @IsEmail()
  readonly email!: string;

  // bcrypt has no minimum; this rejects trivially weak passwords.
  @ApiProperty({ minLength: 8 })
  @Field()
  @IsString()
  @MinLength(8)
  readonly password!: string;
}

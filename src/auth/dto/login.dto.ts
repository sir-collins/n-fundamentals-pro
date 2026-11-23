import { ApiProperty } from '@nestjs/swagger';
import { Field, InputType } from '@nestjs/graphql';
import { IsEmail, IsString } from 'class-validator';

/**
 * Login credentials. Over REST this only documents the body for Swagger:
 * `LocalStrategy` reads the raw request, so these validators never run.
 * They do run for the GraphQL `login` mutation.
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

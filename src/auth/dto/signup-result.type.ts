import { Field, Int, ObjectType } from '@nestjs/graphql';

/**
 * GraphQL result of `signup`: `id` and `email` only. Not the `User` type,
 * because `User.role` is non-nullable and `signup` doesn't return it; a
 * client selecting `role` would get a null-field error.
 */
@ObjectType()
export class SignupResult {
  @Field(() => Int)
  id!: number;

  @Field()
  email!: string;
}

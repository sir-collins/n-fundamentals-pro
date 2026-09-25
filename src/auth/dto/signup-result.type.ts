import { Field, Int, ObjectType } from '@nestjs/graphql';

/**
 * `signup`'s real, guaranteed return shape — `id`/`email` only, same as
 * REST's `Pick<User, 'id' | 'email'>`. Deliberately not the full `User`
 * type: `User.role` is non-nullable there (every other legitimate use
 * always has it), so returning a partial `User` from `signup` would
 * violate that contract the moment a client actually asks for `role` —
 * found this exactly that way, not guessed in advance.
 */
@ObjectType()
export class SignupResult {
  @Field(() => Int)
  id!: number;

  @Field()
  email!: string;
}

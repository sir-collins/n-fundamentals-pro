import { Field, ObjectType } from '@nestjs/graphql';

/**
 * `login`'s GraphQL return shape — REST returns one of two distinct
 * TypeScript union members (`{ access_token }` or `{ twoFactorRequired,
 * tempToken }`), trivial over loose JSON but GraphQL needs one concrete
 * type. One type with both pairs nullable, not a real GraphQL union —
 * simpler, and fully usable for both flows: whichever pair is relevant
 * gets populated, the other stays null.
 */
@ObjectType()
export class LoginResult {
  @Field(() => String, { nullable: true })
  accessToken?: string;

  @Field(() => Boolean, { nullable: true })
  twoFactorRequired?: boolean;

  @Field(() => String, { nullable: true })
  tempToken?: string;
}

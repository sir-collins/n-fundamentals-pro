import { Field, ObjectType } from '@nestjs/graphql';

/**
 * GraphQL result of `login`. A single type with nullable fields rather than
 * a GraphQL union: either `accessToken` or `twoFactorRequired` + `tempToken`
 * is set, the other stays null.
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

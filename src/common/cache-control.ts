import {
  DirectiveLocation,
  GraphQLBoolean,
  GraphQLDirective,
  GraphQLEnumType,
  GraphQLInt,
} from 'graphql';

/** How long public, same-for-everyone data may be served from the cache. */
export const PUBLIC_CACHE_MAX_AGE = 30;

/**
 * Apollo cache hint for public data, applied with `@Directive(...)` at the
 * type level (`Song`, `Artist`, `PaginatedSongs`) so it covers every field
 * returning that type.
 *
 * Opt-in on purpose. Apollo caches a response for the *lowest* `maxAge`
 * of any field in it, and an object-typed field with no hint counts as
 * `0`. So anything not marked here, `User` (and with it `profile`)
 * included, is never cached, and neither is any query that touches it.
 * A global default would flip that: every private field would then need
 * to remember to opt out.
 *
 * Accepted trade-off: after a write, cached reads stay stale for up to
 * `PUBLIC_CACHE_MAX_AGE` seconds (no invalidation).
 */
export const PUBLIC_CACHE_HINT = `@cacheControl(maxAge: ${PUBLIC_CACHE_MAX_AGE})`;

const cacheControlScope = new GraphQLEnumType({
  name: 'CacheControlScope',
  values: { PUBLIC: {}, PRIVATE: {} },
});

/**
 * Apollo's documented `@cacheControl` definition, declared in the schema
 * so `schema.gql` stays valid SDL. Apollo reads the hints themselves from
 * each type's and field's AST, which `@Directive()` writes into.
 */
export const cacheControlDirective = new GraphQLDirective({
  name: 'cacheControl',
  locations: [
    DirectiveLocation.FIELD_DEFINITION,
    DirectiveLocation.OBJECT,
    DirectiveLocation.INTERFACE,
    DirectiveLocation.UNION,
  ],
  args: {
    maxAge: { type: GraphQLInt },
    scope: { type: cacheControlScope },
    inheritMaxAge: { type: GraphQLBoolean },
  },
});

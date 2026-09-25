import { Provider } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';

export const PUB_SUB = 'PUB_SUB';

/**
 * A `useValue` provider, not `PubSub` listed directly in `providers` —
 * `PubSub`'s constructor takes an optional interface-typed param
 * (`PubSubOptions`), which Nest's reflection-based DI can't resolve on
 * its own (TS interfaces erase to `Object` at runtime, an unregistered
 * token). Constructing it manually here sidesteps that entirely.
 */
export const pubSubProvider: Provider = {
  provide: PUB_SUB,
  useValue: new PubSub(),
};

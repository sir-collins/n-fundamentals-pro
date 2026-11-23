import { Provider } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';

export const PUB_SUB = 'PUB_SUB';

/**
 * In-memory, so it only reaches subscribers on this process. A `useValue`
 * provider because Nest's DI can't resolve `PubSub`'s interface-typed
 * constructor parameter.
 */
export const pubSubProvider: Provider = {
  provide: PUB_SUB,
  useValue: new PubSub(),
};

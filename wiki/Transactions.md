---
title: Transactions
---

# Transactions

Transactions require a replica set. With the mongodb driver, every operation of a transaction must receive the `session`.
nestjs-mongo can store the session in an async context instead, so every operation of the manager, of the repositories
and of the validators (`@IsUnique`, `@IsValidRelationship`) uses it automatically.

## In a transaction function

```ts
await this.em.startSessionWithTransaction(
    async (session) => {
        const order = await this.em.save(Object.assign(new Order(), { customerId }));
        await this.em.save(Object.assign(new Invoice(), { orderId: order._id })); // @IsValidRelationship sees the order
        await this.em.deleteOne(Cart, { customerId });
    },
    { useContext: true }
);
```

- The function runs in `session.withTransaction()`: it is committed when it resolves, aborted when it throws, and retried by the driver on transient errors (so it must be safe to run again).
- `useContext: true` stores the session in a [session context](#the-session-context). Without it, pass `{ session }` to each operation yourself.
- Options: `transactionOptions` (read/write concern...) and `sessionOptions` of the driver.
- Run the operations one after the other (`await` each one). Do not use `Promise.all` inside a transaction: the driver does not support parallel operations on a session.
  The validators already queue their queries for this reason.

## The session context

The session is stored with Node's [`AsyncLocalStorage`](https://nodejs.org/api/async_context.html#class-asynclocalstorage):
everything called from the transaction function, sync or async, sees it, and concurrent requests never share it.

`startSessionWithTransaction(..., { useContext: true })` opens its own context for the duration of the transaction.
It works anywhere (an HTTP request, a CLI command, a queue consumer, a test), without any setup, and it does not change the session of an outer context.

## Sharing a session in a request

To set a session yourself (with the low level methods below) and share it with everything that handles a request, apply `SessionLoaderMiddleware`:
it runs each request in its own context.

```ts
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { SessionLoaderMiddleware } from 'nestjs-mongo';

@Module({/* ... */})
export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(SessionLoaderMiddleware).forRoutes('*path'); // '*' with NestJS 10
    }
}
```

Outside of a request, open a context with `runInSessionContext()`:

```ts
import { runInSessionContext } from 'nestjs-mongo';

await runInSessionContext(async () => {
    const session = em.getClient().startSession();
    em.setSessionContext(session);
    try {
        /* every operation here uses the session */
    } finally {
        em.clearSessionContext();
        await session.endSession();
    }
});
```

## Low level

`em.setSessionContext(session)`, `em.getSessionContext()` and `em.clearSessionContext()` manage the session of the current context directly,
if you start and end sessions yourself. `setSessionContext()` throws `No session context: ...` when the code does not run in a context
(`runInSessionContext()` or `SessionLoaderMiddleware`). `hasSessionContext()` tells whether the code runs in one.

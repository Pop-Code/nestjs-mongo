---
title: Upgrading
---

# Upgrading

## From 0.14 to 0.15

0.15 supports NestJS 10 to 12 and the mongodb driver 7.

### Requirements

- Node.js **22.12** or later (NestJS 12 is published as ESM only and is loaded with `require(esm)`).
- `mongodb` **7** (peer dependency): `npm install mongodb@7`. The driver supports MongoDB server 4.4 to 9.0.
  Read the driver upgrade notes for the changes between 4.x and 7.x: <https://www.mongodb.com/docs/drivers/node/current/upgrade/>.
- `@nestjs/common` and `@nestjs/core` 10, 11 or 12, `class-validator` 0.14 or 0.15, `reflect-metadata` 0.1 or 0.2.

### Changes

- `FindOptions` is no longer generic in the driver: `find()` and `findOne()` options are typed `FindOptions`.
- `SessionLoaderMiddleware.use()` no longer uses the express `Request`/`Response` types (the package no longer depends on express types). It works with the fastify adapter too.
- `@Slugify` throws a plain `Error` instead of a NestJS internal `RuntimeException` when it has neither `keys` nor `generate`.
- `RequiredRelationshipPipe` now throws a `404 Not Found` when the entity does not exist (it threw a `TypeError`, so a `500`).
- `EntityManager.isIdsQuery()` now returns `true` for `{ _id: { $in: [...] } }` (it always returned `false`).
- Named connections work: `MongoModule` and `MongoFeatureModule` no longer require the default connection, `em.getRepository()` finds the repositories of named connections,
  and `@IsUnique` / `@IsValidRelationship` query the connection of the model (they used the last created connection).
- Sessions are stored with Node's `AsyncLocalStorage` instead of cls-hooked (unmaintained), which is no longer a dependency:
    - `startSessionWithTransaction(fn, { useContext: true })` no longer needs `SessionLoaderMiddleware` or a namespace: it opens its own context.
    - To open a context yourself, replace `getNamespace(SESSION_LOADER_NAMESPACE).run(...)` / `createNamespace(...)` with `runInSessionContext(...)`.
    - `SessionLoaderService.getSession()` is removed: use `getSessionContext()`.
    - `setSessionContext()` outside of a context throws `No session context: ...` (cls-hooked threw `No context available`).
    - The `SESSION_LOADER_NAMESPACE` and `MONGO_SESSION_KEY` constants are removed.
- Removed unused code: `getDataloaderToken()`, the `MongoOptionsFactory` interface and the `WithValidRelationship` type
  (the `with` option of `@IsValidRelationship` is typed `WithRelationshipTest`, which also receives the session).
- `@Index()` and the `index.description` option of `@Relationship` are typed `Partial<IndexDescription>` (the driver index options).
  They no longer accept the `createIndexes` command options (`session`, `commitQuorum`...), which had no effect per index.
- The unused `uuid` and `global` dependencies were removed.

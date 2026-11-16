# Changelog

All notable changes to this project will be documented in this file.

This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.15.0] - 2026-11-15

### BREAKING CHANGE

- Require the mongodb driver v7 (peer dependency `mongodb@^7`, MongoDB server 4.4 to 9.0)
- Node engine is now `>= 22.12.0` (required to load the ESM-only NestJS v12 packages with `require(esm)`)
- Drop NestJS v8 and v9, support NestJS v10, v11 and v12
- `find()` / `findOne()` options are typed `FindOptions` (no longer generic in the driver)
- Remove unused code: `getDataloaderToken()`, `MongoOptionsFactory` and the `WithValidRelationship` type (use `WithRelationshipTest`)
- `@Index()` and the `index.description` option of `@Relationship` are typed `Partial<IndexDescription>`: the `createIndexes` command options (`session`, `commitQuorum`...) are no longer accepted
- Replace cls-hooked (unmaintained) with Node's `AsyncLocalStorage` to store the mongo session of the current context. Use `runInSessionContext()` instead of a cls-hooked namespace; remove `SessionLoaderService.getSession()` and the `SESSION_LOADER_NAMESPACE` and `MONGO_SESSION_KEY` constants

### Fixed

- Named connections: `MongoModule` and `MongoFeatureModule` no longer inject the default entity manager (an app with only named connections failed to start)
- `EntityManager.getRepository()` finds the repositories of named connections
- `@IsUnique` and `@IsValidRelationship` query the connection the model is registered on (they used the last created connection)
- `RequiredRelationshipPipe` throws a `NotFoundException` when the entity does not exist (it threw a `TypeError`)
- `EntityManager.isIdsQuery()` detects `{ _id: { $in: [...] } }` queries (it always returned `false`)

### Changed

- Support class-validator v0.15 and reflect-metadata v0.2
- Use `instanceToPlain` / `plainToInstance` (the deprecated class-transformer aliases are no longer used)
- `SessionLoaderMiddleware` no longer depends on the express types
- `@Slugify` throws a plain `Error` (no import of a NestJS internal module)
- Remove the unused `uuid` and `global` dependencies
- Update dev dependencies (TypeScript 6, Jest 30, ESLint 10 with flat config, Prettier 3, typedoc 0.28) and switch to yarn v1
- CI: tests on Node 24 and 26 with MongoDB 6.0, 7.0 and 8.0, and a smoke test on Node 22; bump all GitHub Actions
- Release workflow: create the GitHub release with the `gh` CLI and stage the npm release (trusted publishing with provenance), see `RELEASING.md`
- Define package contents with the `files` field in `package.json` (replaces `.npmignore`)

### Added

- Documentation: TSDoc on the public API, a new README, guides in the [wiki](https://github.com/Pop-Code/nestjs-mongo/wiki)
- `getModelEntityManager()` helper
- `runInSessionContext()`, `hasSessionContext()` and `SessionLoaderService.run()`
- `startSessionWithTransaction(fn, { useContext: true })` runs in its own session context: it no longer needs `SessionLoaderMiddleware`, and does not change the session of an outer context
- Tests for named connections, transactions, session contexts (including an express end-to-end test) and pipes

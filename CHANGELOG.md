# Changelog

All notable changes to this project will be documented in this file.

This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### BREAKING CHANGE

- The default `exceptionFactory` throws an `EntityValidationException` (a `BadRequestException` with the `ValidationError[]` in `errors`) instead of the `ValidationError[]` array
- `deleteOne()` resolves `deletedCount: 0` when no document matches (it threw a `NotFoundException`)
- `deleteMany()` deletes the documents it found (by `_id`), and runs the cascades and hooks of each of them
- The index creation errors are thrown when the models are registered (they were logged with `console.error`)
- `merge()` merges the sub objects (the other properties of a sub object are kept), sets `null` values, and ignores `undefined` values
- `fromPlain()` loads the entities with the new loading layer (see Added); pass class-transformer options to use `plainToInstance()`
- `MongoModule.forRootAsync()` returns a `DynamicModule` (no longer a `Promise`)
- `EntityManager.getRelationship()` / `getRelationships()` and the repository methods check that the property is a key of the entity
- `EntityRepository.save()` / `deleteMany()` take typed options (no more `...args`)

### Fixed

- `save()` inserts an entity with an `_id` set by the application (the update matched nothing and the entity was not saved)
- `save()` no longer strips the properties without decorators from the entity (only from the written document)
- `@IsUnique` and `@IsValidRelationship` messages are kept per validation (concurrent validations could get the message of another one)
- `@IsUnique` counts the soft deleted documents, like the unique index
- `@IsValidRelationship` validates an array of ids with one query
- `EntityService.list()` runs the count in the session of the context, at the same time as the query
- `EntityService.update(id, data, true)` writes only the properties of `data`
- `registerModel()` no longer fails when another process creates the collection at the same time
- `RelationshipPipe` / `RequiredRelationshipPipe` use the connection of the model
- `toJSON()` removes the `@Exclude()` properties and getters
- The mongodb driver options of the entity manager no longer receive the options of the module (`skipValidation`, `validatorOptions`)

### Added

- `EntityManager` and `EntityRepository` methods: `findById()`, `findByIds()`, `findOneOrFail()`, `exists()`, `distinct()`, `estimatedCount()`, `aggregate()` (with `as` to load instances of a class), `paginate()`, `paginateByCursor()`, `updateOne()`, `updateMany()`, `findOneAndUpdate()`, `upsert()`, `bulkWrite()`, `findOneAndDelete()`, `restore()`, `insertMany()`, `saveMany()`, `populate()`, `ping()`, `withTransaction()`
- `patch(entity, changes)`: validates the entity and writes only the changed properties
- `findWithRelationships()`: finds entities and loads their relationships with one aggregation (`$lookup`)
- `MongoHealthIndicator` for `@nestjs/terminus` v11 / v12, imported from `nestjs-mongo/terminus` (optional peer dependency)
- `@Version()`: optimistic locking, `save()` / `patch()` throw an `OptimisticLockException` when the document changed since it was loaded
- `@DeletedAt()`: soft delete, with the `withDeleted` and `hard` options
- Lifecycle hooks: `@BeforeInsert()`, `@AfterInsert()`, `@BeforeUpdate()`, `@AfterUpdate()`, `@BeforeSave()`, `@AfterSave()`, `@BeforeDelete()`, `@AfterDelete()`, `@AfterLoad()`
- `@Transactional()` method decorator; nested calls run in the same transaction
- `@Field()` and `@Embedded()`: the loading of the entities no longer uses class-transformer's `plainToInstance()`; the `@Type()`, `@Transform()`, `@Exclude()` and `@Expose()` decorators of class-transformer are still supported
- Errors: `EntityNotFoundException` (404), `DuplicateKeyException` (409, mapped from the duplicate key errors), `OptimisticLockException` (409), `EntityValidationException` (400)
- `MongoModule.forRoot()`, and the `useClass` / `useExisting` options of `forRootAsync()` (`MongoOptionsFactory`)
- Module options: `autoIndex`, `syncIndexes` (drop the indexes that are not declared, recreate the changed ones), `schemaValidation` (a `$jsonSchema` validator generated from the validation decorators, see `getJsonSchema()`), `migrations` and `migrationsRun`
- `@Index()` on a class, for compound indexes
- `MigrationRunner`: runs and reverts migrations, records them in a collection, with a lock between processes
- `nestjs-mongo migrate <up|down|status>` command line (and `runCli()` / `loadMigrations()`)
- `InjectRepository()`, alias of `InjectEntityRepository()`
- The change streams opened with `watch()` are closed when the module is destroyed

## [0.16.0] - 2026-11-15

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

## [0.15.0] - 2025-06-30

### Changed

- Support NestJS v11
- Support the mongodb driver v6

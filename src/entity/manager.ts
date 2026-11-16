import { ClassConstructor, ClassTransformOptions } from 'class-transformer';
import { isEmpty, validate, ValidatorOptions } from 'class-validator';
import Debug from 'debug';
import {
    AggregationCursor,
    AnyBulkWriteOperation,
    BulkWriteOptions,
    BulkWriteResult,
    ChangeStream,
    ChangeStreamOptions,
    ClientSession,
    Collection,
    DeleteResult,
    DistinctOptions,
    Document,
    EstimatedDocumentCountOptions,
    Filter,
    FindCursor,
    IndexDescription,
    MatchKeysAndValues,
    MongoClient,
    OptionalUnlessRequiredId,
    ObjectId,
    UpdateFilter,
    UpdateResult,
    WithId
} from 'mongodb';

import { DEBUG, DEFAULT_CONNECTION_NAME, MODEL_ENTITY_MANAGER_METADATA_NAME } from '../constants';
import {
    DuplicateKeyException,
    EntityNotFoundException,
    EntityValidationException,
    mapMongoError,
    OptimisticLockException
} from '../errors';
import { getObjectName } from '../helpers';
import { getIndexMetadatas } from '../indexs';
import { getDeletedAtProperty, getVersionProperty, hydrate, toDocument } from '../mapping';
import { getEntityRepositoryToken, InjectMongoClient } from '../module/injection';
import { ExceptionFactory } from '../module/interfaces';
import { CascadeType } from '../relationship/interfaces';
import {
    getRelationshipMetadata,
    getRelationshipsCascadesMetadata,
    setRelationshipsCascadesMetadata
} from '../relationship/metadata';
import { getJsonSchema } from '../schema/json-schema';
import { runInSessionContext } from '../session/context';
import { SessionLoaderService } from '../session/service';
import { ClientSessionContext } from '../session/types';
import { ensureSequentialTransaction } from '../session/utils';
import { fromPlain, merge } from '../transformer/utils';
import { EntityHook, runHooks, runSyncHooks } from './hooks';
import { EntityInterface } from './interfaces';
import {
    AggregateEntityOptions,
    CountEntityOptions,
    CursorPaginatedResult,
    CursorPaginateOptions,
    DeleteEntityOptions,
    ENTITY_OPTION_KEYS,
    EntityOptionKey,
    EntityTransactionOptions,
    EntityWithRelationships,
    FindEntityOptions,
    FindOneAndDeleteEntityOptions,
    FindOneAndUpdateEntityOptions,
    FindWithRelationshipsOptions,
    PaginatedResult,
    PaginateOptions,
    SaveOptions,
    SoftDeleteOptions,
    UpdateEntityOptions
} from './options';
import { EntityRepository } from './repository';

/** The options of an entity manager, set by `MongoModule.forRoot()` / `forRootAsync()`. */
export interface EntityManagerOptions {
    /** The name of the connection. */
    connectionName?: string;
    /** Create the indexes of the models (default `true`). */
    autoIndex?: boolean;
    /** Drop the indexes that are not declared on the models, and recreate the changed ones (default `false`). */
    syncIndexes?: boolean;
    /** Set a `$jsonSchema` validator, generated from the validation decorators, on the collections of the models. */
    schemaValidation?: {
        validationAction?: 'error' | 'warn';
        validationLevel?: 'strict' | 'moderate' | 'off';
    };
}

const managers = new Map<string, EntityManager>();

/** Registers the entity manager of a connection, for the `@Transactional()` decorator (done by `MongoModule`). */
export function registerEntityManager(em: EntityManager): void {
    managers.set(em.getConnectionName(), em);
}

/** The entity manager of a connection, used by the `@Transactional()` decorator. */
export function getEntityManager(connectionName: string = DEFAULT_CONNECTION_NAME): EntityManager | undefined {
    return managers.get(connectionName);
}

const defaultIndexName = (key: IndexDescription['key']) =>
    Object.entries(key as Record<string, unknown>)
        .map(([k, v]) => `${k}_${String(v)}`)
        .join('_');

/** The `undefined` properties of an entity, removed from the document by `save()`. */
const getUndefinedKeys = (value: object): string[] =>
    Object.keys(value).filter((key) => !key.startsWith('__') && value[key] === undefined);

/**
 * The entity manager of a connection: it saves, finds and deletes the entities of the registered models,
 * in the session of the current session context.
 */
export class EntityManager {
    protected readonly repositories: Map<string, any> = new Map();
    protected readonly models: Map<string, ClassConstructor<any>> = new Map();
    protected readonly changeStreams: Set<ChangeStream<any, any>> = new Set();
    /** The sessions of the transactions started by the manager. */
    protected readonly sessions: WeakSet<ClientSession> = new WeakSet();

    protected log = Debug(DEBUG + ':EntityManager');

    constructor(
        @InjectMongoClient()
        protected readonly client: MongoClient,
        protected readonly sessionLoaderService: SessionLoaderService,
        protected readonly exceptionFactory: ExceptionFactory = (errors) => new EntityValidationException(errors),
        protected readonly options: EntityManagerOptions = {}
    ) {}

    /** The name of the connection of the manager. */
    getConnectionName(): string {
        return this.options.connectionName ?? DEFAULT_CONNECTION_NAME;
    }

    /**
     * Registers a model: creates its collection, its indexes, and its schema validator
     * (with the `schemaValidation` option).
     */
    async registerModel<Model extends EntityInterface>(
        name: string,
        model: ClassConstructor<Model>
    ): Promise<EntityManager> {
        this.log('Add model %s as %s', model.name, name);
        this.models.set(name, model);
        // the validators (@IsUnique, @IsValidRelationship) use the manager of the connection of the model
        Reflect.defineMetadata(MODEL_ENTITY_MANAGER_METADATA_NAME, this, model);

        // the collection must exist to use it in a transaction
        const collectionName = this.getCollectionName(model);
        const cursor = this.getDatabase().listCollections({ name: collectionName }, { nameOnly: true });
        if ((await cursor.toArray()).length === 0) {
            this.log('Creating collection %s for model %s', collectionName, name);
            try {
                await this.getDatabase().createCollection(collectionName);
            } catch (e) {
                // NamespaceExists: created by another process
                if (e?.code !== 48) throw e;
            }
        }

        if (this.options.schemaValidation !== undefined) {
            await this.getDatabase().command({
                collMod: collectionName,
                validator: { $jsonSchema: getJsonSchema(model) },
                validationAction: this.options.schemaValidation.validationAction ?? 'error',
                validationLevel: this.options.schemaValidation.validationLevel ?? 'strict'
            });
        }

        setRelationshipsCascadesMetadata(model, this);
        if (this.options.syncIndexes === true) {
            await this.syncIndexes(model);
        } else if (this.options.autoIndex !== false) {
            await this.createIndexs(model);
        }

        return this;
    }

    getModel(id: string): ClassConstructor<any> | undefined {
        return this.models.get(id);
    }

    getModels(): Map<string, ClassConstructor<any>> {
        return this.models;
    }

    /** The registered model of an entity. */
    protected getModelOf(entity: object): ClassConstructor<any> {
        for (const model of this.models.values()) {
            if (model === entity.constructor) return model;
        }
        const model = this.getModel(entity.constructor.name);
        if (model === undefined) {
            throw new Error(`Can not find model ${entity.constructor.name}`);
        }
        return model;
    }

    registerRepository<Model extends EntityInterface, R extends EntityRepository<Model> = EntityRepository<Model>>(
        name: string,
        repository: R
    ): EntityManager {
        this.log('Add repository %s as %s', repository.constructor.name, name);
        this.repositories.set(name, repository);
        return this;
    }

    getRepository<Model extends EntityInterface, R extends EntityRepository<Model> = EntityRepository<Model>>(
        classType: ClassConstructor<Model>
    ): R {
        for (const repository of this.repositories.values()) {
            if (repository.getClassType() === classType) {
                return repository;
            }
        }
        return this.repositories.get(getEntityRepositoryToken(classType.name, this.getConnectionName()));
    }

    getClient(): MongoClient {
        return this.client;
    }

    getDatabase(databaseName?: string) {
        return this.client.db(databaseName);
    }

    /** Runs the `ping` command, resolves `true` when the server answers (for a health check). */
    async ping(): Promise<boolean> {
        const result = await this.getDatabase().command({ ping: 1 });
        return result?.ok === 1;
    }

    getSessionLoaderService() {
        return this.sessionLoaderService;
    }

    getSessionContext(): ClientSessionContext {
        return this.sessionLoaderService.getSessionContext();
    }

    setSessionContext(mongoSession: ClientSession): void {
        this.sessionLoaderService.setSessionContext(mongoSession);
    }

    clearSessionContext(): void {
        this.sessionLoaderService.clearSessionContext();
    }

    getCollectionName<Model extends EntityInterface>(nameOrInstance: Model | ClassConstructor<Model>): string {
        let name: string | undefined;
        if (typeof nameOrInstance === 'object' || typeof nameOrInstance === 'function') {
            name = Reflect.getMetadata(
                'mongo:collectionName',
                typeof nameOrInstance === 'object' ? nameOrInstance.constructor : nameOrInstance
            );
        }

        if (name === undefined) {
            throw new Error('@Collection decorator is required to use a class as model');
        }

        return name;
    }

    getCollection<Model extends EntityInterface>(
        nameOrInstance: Model | ClassConstructor<Model>,
        databaseName?: string
    ): Collection<Document> {
        return this.getDatabase(databaseName).collection(this.getCollectionName(nameOrInstance));
    }

    /** The collection of a model, typed with the model: the filters and the updates of the manager are checked. */
    protected collection<Model extends EntityInterface>(model: ClassConstructor<Model>): Collection<Model> {
        return this.getDatabase().collection<Model>(this.getCollectionName(model));
    }

    /** The options for the driver: the session of the context, without the options of the module. */
    protected driverOptions<O extends object>(options: O): Omit<O, EntityOptionKey> & { session?: ClientSession } {
        const ctx = this.getSessionContext();
        const driverOptions = { ...options };
        for (const key of ENTITY_OPTION_KEYS) Reflect.deleteProperty(driverOptions, key);
        return ctx !== undefined ? { session: ctx.session, ...driverOptions } : driverOptions;
    }

    /** Adds the soft delete condition to a filter (for a model with a `@DeletedAt()` property). */
    protected scopeFilter<Model extends object>(
        classType: ClassConstructor<Model>,
        filter: Filter<Model> = {},
        options: SoftDeleteOptions = {}
    ): Filter<Model> {
        const deletedAt = getDeletedAtProperty(classType);
        if (deletedAt === undefined || options.withDeleted === true || deletedAt in filter) {
            return filter;
        }
        return { ...filter, [deletedAt]: null };
    }

    /** Runs a write of the driver, and maps its errors (see `mapMongoError()`). */
    protected async write<T>(fn: () => Promise<T>): Promise<T> {
        try {
            return await fn();
        } catch (e) {
            throw mapMongoError(e);
        }
    }

    async validate<Model extends EntityInterface = any>(
        obj: Model,
        validatorOptions: ValidatorOptions = {},
        throwError = false
    ) {
        const errors = await validate(obj, {
            validationError: { target: true, value: true },
            whitelist: true,
            ...validatorOptions
        });

        if (errors.length > 0 && throwError) {
            throw this.exceptionFactory(errors);
        }

        return errors;
    }

    /**
     * The copy of an entity that is validated and written: the validation (`whitelist`)
     * removes the properties without decorators from the copy, not from the entity.
     */
    protected async prepare<Model extends EntityInterface>(entity: Model, options: SaveOptions): Promise<Model> {
        const proxy: Model = Object.assign(Object.create(Object.getPrototypeOf(entity)), entity);
        if (options.skipValidation !== true) {
            await this.validate(proxy, options.validatorOptions, true);
        }
        return proxy;
    }

    /**
     * Updates the document of an entity with `$set` / `$unset`, checks the version of a model with a `@Version()`
     * property, and sets `updatedAt`.
     */
    protected async updateEntity<Model extends EntityInterface>(
        model: ClassConstructor<Model>,
        entity: Model,
        $set: Partial<Model>,
        $unset: string[],
        options: SaveOptions,
        upsert: boolean
    ): Promise<void> {
        const versionProperty = getVersionProperty(model);
        const version: unknown = versionProperty !== undefined ? Reflect.get(entity, versionProperty) : undefined;
        const updatedAt = new Date();
        // updatedAt, the @Version() property and the $unset paths come from the model metadata:
        // the type of the model can not express them
        const fields: Document = { ...$set, updatedAt };
        delete fields._id;
        const filter: Document = { _id: entity._id };

        if (versionProperty !== undefined) {
            if (typeof version === 'number') {
                filter[versionProperty] = version;
                upsert = false;
            } else {
                filter[versionProperty] = { $exists: false };
            }
            fields[versionProperty] = (typeof version === 'number' ? version : 0) + 1;
        }

        const update: Document = { $set: fields };
        if ($unset.length > 0) {
            update.$unset = Object.fromEntries($unset.map((path) => [path, '']));
        }

        let matchedCount: number;
        try {
            ({ matchedCount } = await this.write(
                async () =>
                    await this.collection(model).updateOne(filter as Filter<Model>, update as UpdateFilter<Model>, {
                        ...this.driverOptions(options),
                        upsert
                    })
            ));
        } catch (e) {
            // the upsert of a versioned entity without version conflicts with an existing document
            if (versionProperty !== undefined && e instanceof DuplicateKeyException && version === undefined) {
                throw new OptimisticLockException(model.name, entity._id, 0);
            }
            throw e;
        }

        if (matchedCount === 0 && !upsert) {
            if (versionProperty !== undefined) {
                throw new OptimisticLockException(model.name, entity._id, typeof version === 'number' ? version : 0);
            }
            throw new EntityNotFoundException(model.name, { _id: entity._id });
        }

        entity.updatedAt = updatedAt;
        if (versionProperty !== undefined) {
            Reflect.set(entity, versionProperty, fields[versionProperty]);
        }
    }

    /** Sets the version 1 of a new entity of a model with a `@Version()` property. */
    protected setInitialVersion<Model extends EntityInterface>(model: ClassConstructor<Model>, ...entities: Model[]) {
        const versionProperty = getVersionProperty(model);
        if (versionProperty === undefined) return;
        for (const entity of entities) Reflect.set(entity, versionProperty, 1);
    }

    /**
     * Saves an entity, after its validation and its `@BeforeInsert()` / `@BeforeUpdate()` hooks.
     *
     * - without `_id`, the entity is inserted;
     * - with an `_id`, every property is written with `$set` (the `undefined` properties are removed with `$unset`),
     *   and the document is inserted when it does not exist.
     *
     * For a model with a `@Version()` property, the update fails with an `OptimisticLockException` when the version
     * of the document is not the version of the entity. To change some properties only, use {@link patch}.
     */
    async save<Model extends EntityInterface>(
        entity: Model | WithId<Model>,
        options: SaveOptions = {}
    ): Promise<WithId<Model>> {
        const model: ClassConstructor<Model> = this.getModelOf(entity);
        const isNew = isEmpty(entity._id);
        this.log('saving %s', model.name);

        if (options.skipHooks !== true) {
            await runHooks(entity, isNew ? EntityHook.BEFORE_INSERT : EntityHook.BEFORE_UPDATE);
        }
        const proxy = await this.prepare(entity, options);

        if (isNew) {
            this.setInitialVersion(model, proxy);
            const document = toDocument(proxy) as OptionalUnlessRequiredId<Model>;
            const { insertedId } = await this.write(
                async () => await this.collection(model).insertOne(document, this.driverOptions(options))
            );
            entity._id = insertedId;
            this.setInitialVersion(model, entity);
        } else {
            await this.updateEntity(model, entity, toDocument(proxy), getUndefinedKeys(proxy), options, true);
        }

        if (options.skipHooks !== true) {
            await runHooks(entity, isNew ? EntityHook.AFTER_INSERT : EntityHook.AFTER_UPDATE);
        }
        this.log('%s %s saved', model.name, entity._id?.toHexString());
        return entity as WithId<Model>;
    }

    /**
     * Saves the entities one after the other (see {@link save}).
     */
    async saveMany<Model extends EntityInterface>(
        entities: Array<Model | WithId<Model>>,
        options: SaveOptions = {}
    ): Promise<Array<WithId<Model>>> {
        const saved: Array<WithId<Model>> = [];
        for (const entity of entities) {
            saved.push(await this.save(entity, options));
        }
        return saved;
    }

    /**
     * Inserts new entities of a model with one `insertMany`, after their validation and their `@BeforeInsert()` hooks.
     */
    async insertMany<Model extends EntityInterface>(
        entities: Model[],
        options: SaveOptions & BulkWriteOptions = {}
    ): Promise<Array<WithId<Model>>> {
        if (entities.length === 0) return [];
        const model: ClassConstructor<Model> = this.getModelOf(entities[0]);
        const documents: Array<OptionalUnlessRequiredId<Model>> = [];
        for (const entity of entities) {
            if (this.getModelOf(entity) !== model) {
                throw new Error(`insertMany() inserts the entities of one model (${model.name})`);
            }
            if (!isEmpty(entity._id)) {
                throw new Error(
                    `insertMany() inserts new entities, the ${model.name} ${String(entity._id)} has an _id`
                );
            }
            if (options.skipHooks !== true) await runHooks(entity, EntityHook.BEFORE_INSERT);
            const proxy = await this.prepare(entity, options);
            this.setInitialVersion(model, proxy);
            documents.push(toDocument(proxy) as OptionalUnlessRequiredId<Model>);
        }
        const { insertedIds } = await this.write(
            async () => await this.collection(model).insertMany(documents, this.driverOptions(options))
        );
        for (const [index, entity] of entities.entries()) {
            entity._id = insertedIds[index];
            this.setInitialVersion(model, entity);
            if (options.skipHooks !== true) await runHooks(entity, EntityHook.AFTER_INSERT);
        }
        return entities as Array<WithId<Model>>;
    }

    /**
     * Changes some properties of a saved entity: the changes are applied to the entity, the entity is validated,
     * and only the changed properties are written (a property set to `undefined` is removed).
     * Runs the `@BeforeUpdate()` / `@AfterUpdate()` hooks, and checks the version of a model with a `@Version()` property.
     *
     * @throws EntityNotFoundException when the document does not exist
     */
    async patch<Model extends EntityInterface>(
        entity: Model | WithId<Model>,
        changes: Partial<Model>,
        options: SaveOptions = {}
    ): Promise<WithId<Model>> {
        const model: ClassConstructor<Model> = this.getModelOf(entity);
        if (isEmpty(entity._id)) {
            throw new Error(`patch() changes a saved entity, the ${model.name} has no _id`);
        }
        // a WithId<Model> is a Model with a required _id
        const target = Object.assign(entity as Model, changes);
        if (options.skipHooks !== true) await runHooks(target, EntityHook.BEFORE_UPDATE);
        const proxy = await this.prepare(target, options);
        const document = toDocument(proxy);

        const $set: Partial<Model> = {};
        const $unset: string[] = [];
        for (const key of Object.keys(changes) as Array<keyof Model & string>) {
            if (key === '_id' || key.startsWith('__')) continue;
            if (proxy[key] === undefined) {
                $unset.push(key);
            } else if (key in document) {
                $set[key] = document[key];
            }
        }
        await this.updateEntity(model, entity, $set, $unset, options, false);

        if (options.skipHooks !== true) await runHooks(entity, EntityHook.AFTER_UPDATE);
        return entity as WithId<Model>;
    }

    /**
     * Creates an entity from a document of the database, and runs its `@AfterLoad()` hooks.
     */
    hydrate<T extends object>(classType: ClassConstructor<T>, document: WithId<Document>): WithId<T> {
        // the _id of the document is copied to the entity
        const entity = hydrate(classType, document) as WithId<T>;
        runSyncHooks(entity, EntityHook.AFTER_LOAD);
        return entity;
    }

    async find<Model extends EntityInterface>(
        classType: ClassConstructor<Model>,
        query: Filter<Model> = {},
        options: FindEntityOptions = {}
    ): Promise<FindCursor<WithId<Model>>> {
        this.log('find %s %o', classType.name, query);
        const cursor = this.collection(classType).find(
            this.scopeFilter(classType, query, options),
            this.driverOptions(options)
        );
        return cursor.map((data) => this.hydrate(classType, data));
    }

    async findOne<Model extends EntityInterface>(
        classType: ClassConstructor<Model>,
        query: Filter<Model>,
        options: FindEntityOptions = {}
    ): Promise<WithId<Model> | undefined> {
        this.log('findOne %s %o', classType.name, query, options);
        const obj = await this.collection(classType).findOne(
            this.scopeFilter(classType, query, options),
            this.driverOptions(options)
        );
        if (obj !== null) {
            return this.hydrate(classType, obj);
        }
    }

    /**
     * Finds a document by its `_id` (an `ObjectId`, or its hexadecimal string).
     */
    async findById<Model extends EntityInterface>(
        classType: ClassConstructor<Model>,
        id: ObjectId | string,
        options: FindEntityOptions = {}
    ): Promise<WithId<Model> | undefined> {
        return await this.findOne(classType, { _id: new ObjectId(id) } as Filter<Model>, options);
    }

    /**
     * Finds the documents of a list of `_id`.
     */
    async findByIds<Model extends EntityInterface>(
        classType: ClassConstructor<Model>,
        ids: Array<ObjectId | string>,
        options: FindEntityOptions = {}
    ): Promise<Array<WithId<Model>>> {
        const filter = { _id: { $in: ids.map((id) => new ObjectId(id)) } } as Filter<Model>;
        return await (await this.find(classType, filter, options)).toArray();
    }

    /**
     * Like {@link findOne}, but throws an `EntityNotFoundException` when no document matches.
     */
    async findOneOrFail<Model extends EntityInterface>(
        classType: ClassConstructor<Model>,
        query: Filter<Model>,
        options: FindEntityOptions = {}
    ): Promise<WithId<Model>> {
        const entity = await this.findOne(classType, query, options);
        if (entity === undefined) {
            throw new EntityNotFoundException(classType.name, query);
        }
        return entity;
    }

    async count<Model extends EntityInterface>(
        classType: ClassConstructor<Model>,
        query: Filter<Model> = {},
        options: CountEntityOptions = {}
    ): Promise<number> {
        this.log('count %s %o', classType.name, query);
        return await this.collection(classType).countDocuments(
            this.scopeFilter(classType, query, options),
            this.driverOptions(options)
        );
    }

    /**
     * The count of all the documents of the collection, from its metadata (fast, and includes the soft deleted documents).
     */
    async estimatedCount<Model extends EntityInterface>(
        classType: ClassConstructor<Model>,
        options: EstimatedDocumentCountOptions = {}
    ): Promise<number> {
        return await this.collection(classType).estimatedDocumentCount(options);
    }

    /** True when a document matches the filter. */
    async exists<Model extends EntityInterface>(
        classType: ClassConstructor<Model>,
        query: Filter<Model>,
        options: FindEntityOptions = {}
    ): Promise<boolean> {
        const doc = await this.collection(classType).findOne(this.scopeFilter(classType, query, options), {
            ...this.driverOptions(options),
            projection: { _id: 1 }
        });
        return doc !== null;
    }

    /** The distinct values of a property. */
    async distinct<Model extends EntityInterface>(
        classType: ClassConstructor<Model>,
        key: string,
        query: Filter<Model> = {},
        options: DistinctOptions & SoftDeleteOptions = {}
    ): Promise<any[]> {
        return await this.collection(classType).distinct(
            key,
            this.scopeFilter(classType, query, options),
            this.driverOptions(options)
        );
    }

    /**
     * Runs an aggregation pipeline on the collection of a model. With `as`, each result is loaded
     * as an instance of the class.
     */
    aggregate<T extends object = Document, Model extends EntityInterface = any>(
        classType: ClassConstructor<Model>,
        pipeline: Document[] = [],
        options: AggregateEntityOptions<T> = {}
    ): AggregationCursor<T> {
        const deletedAt = getDeletedAtProperty(classType);
        const stages =
            deletedAt !== undefined && options.withDeleted !== true
                ? [{ $match: { [deletedAt]: null } }, ...pipeline]
                : pipeline;
        const cursor = this.collection(classType).aggregate(stages, this.driverOptions(options));
        const as = options.as;
        if (as !== undefined) {
            return cursor.map((data) => {
                const result = hydrate(as, data);
                runSyncHooks(result, EntityHook.AFTER_LOAD);
                return result;
            });
        }
        return cursor as AggregationCursor<T>;
    }

    /**
     * A page of entities (`skip` / `limit`, `limit` is 50 by default), and the count of the documents that match the filter.
     */
    async paginate<Model extends EntityInterface>(
        classType: ClassConstructor<Model>,
        query: Filter<Model> = {},
        { skip = 0, limit = 50, sort }: PaginateOptions = {},
        options: FindEntityOptions = {}
    ): Promise<PaginatedResult<WithId<Model>>> {
        const ctx = this.getSessionContext();
        const loadData = async () => {
            const cursor = await this.find(classType, query, options);
            if (sort !== undefined) cursor.sort(sort);
            return await cursor.skip(skip).limit(limit).toArray();
        };
        const countData = async () => await this.count(classType, query, options);
        // the operations of a transaction run one after the other
        if (ctx?.session.inTransaction() === true) {
            const data = await ensureSequentialTransaction(ctx, loadData);
            const count = await ensureSequentialTransaction(ctx, countData);
            return { count, data };
        }
        const [data, count] = await Promise.all([loadData(), countData()]);
        return { count, data };
    }

    /**
     * A page of entities sorted by `_id`, after the `_id` of the last item of the previous page
     * (faster than `skip` on large collections).
     */
    async paginateByCursor<Model extends EntityInterface>(
        classType: ClassConstructor<Model>,
        query: Filter<Model> = {},
        { limit = 50, after, direction = 1 }: CursorPaginateOptions = {},
        options: FindEntityOptions = {}
    ): Promise<CursorPaginatedResult<WithId<Model>>> {
        const filter =
            after !== undefined ? { $and: [query, { _id: { [direction === 1 ? '$gt' : '$lt']: after } }] } : query;
        const cursor = await this.find(classType, filter as Filter<Model>, options);
        const data = await cursor
            .sort({ _id: direction })
            .limit(limit + 1)
            .toArray();
        const hasNext = data.length > limit;
        if (hasNext) data.pop();
        return { data, next: hasNext ? data[data.length - 1]._id : undefined };
    }

    /**
     * Adds `updatedAt` and the version increment (for a model with a `@Version()` property) to an update.
     */
    protected prepareUpdate<Model extends EntityInterface>(
        classType: ClassConstructor<Model>,
        update: UpdateFilter<Model> | Document[],
        options: UpdateEntityOptions = {}
    ): UpdateFilter<Model> | Document[] {
        if (Array.isArray(update)) return update;
        const prepared: UpdateFilter<Model> = { ...update };
        if (options.timestamps !== false) {
            // updatedAt and the @Version() property come from the model metadata, the type of the model can not express them
            prepared.$set = { updatedAt: new Date(), ...update.$set } as MatchKeysAndValues<Model>;
        }
        const versionProperty = getVersionProperty(classType);
        if (versionProperty !== undefined && update.$set?.[versionProperty] === undefined) {
            prepared.$inc = { ...update.$inc, [versionProperty]: 1 } as UpdateFilter<Model>['$inc'];
        }
        return prepared;
    }

    /**
     * Updates the first document that matches the filter with update operators (`$set`, `$inc`, `$push`, ...).
     * The entity is not validated and the hooks do not run.
     */
    async updateOne<Model extends EntityInterface>(
        classType: ClassConstructor<Model>,
        query: Filter<Model>,
        update: UpdateFilter<Model> | Document[],
        options: UpdateEntityOptions = {}
    ): Promise<UpdateResult> {
        this.log('updateOne %s %o', classType.name, query);
        return await this.write(
            async () =>
                await this.collection(classType).updateOne(
                    this.scopeFilter(classType, query, options),
                    this.prepareUpdate(classType, update, options),
                    this.driverOptions(options)
                )
        );
    }

    /**
     * Updates all the documents that match the filter with update operators.
     * The entities are not validated and the hooks do not run.
     */
    async updateMany<Model extends EntityInterface>(
        classType: ClassConstructor<Model>,
        query: Filter<Model>,
        update: UpdateFilter<Model> | Document[],
        options: UpdateEntityOptions = {}
    ): Promise<UpdateResult> {
        this.log('updateMany %s %o', classType.name, query);
        return await this.write(
            async () =>
                await this.collection(classType).updateMany(
                    this.scopeFilter(classType, query, options),
                    this.prepareUpdate(classType, update, options),
                    this.driverOptions(options)
                )
        );
    }

    /**
     * Updates the first document that matches the filter, and returns it as an entity
     * (the document after the update, unless `returnDocument: 'before'`).
     */
    async findOneAndUpdate<Model extends EntityInterface>(
        classType: ClassConstructor<Model>,
        query: Filter<Model>,
        update: UpdateFilter<Model> | Document[],
        options: FindOneAndUpdateEntityOptions = {}
    ): Promise<WithId<Model> | undefined> {
        this.log('findOneAndUpdate %s %o', classType.name, query);
        const doc = await this.write(
            async () =>
                await this.collection(classType).findOneAndUpdate(
                    this.scopeFilter(classType, query, options),
                    this.prepareUpdate(classType, update, options),
                    { returnDocument: 'after', ...this.driverOptions(options), includeResultMetadata: false }
                )
        );
        return doc !== null ? this.hydrate(classType, doc) : undefined;
    }

    /**
     * Updates the first document that matches the filter with the values of `data`, or inserts a document
     * (the filter and `data`) when none matches. Returns the entity. The entity is not validated.
     */
    async upsert<Model extends EntityInterface>(
        classType: ClassConstructor<Model>,
        query: Filter<Model>,
        data: Partial<Model>,
        options: FindOneAndUpdateEntityOptions = {}
    ): Promise<WithId<Model>> {
        const $set = toDocument(data);
        delete $set._id;
        delete $set.createdAt;
        const entity = await this.findOneAndUpdate(
            classType,
            query,
            { $set, $setOnInsert: { createdAt: new Date() } } as UpdateFilter<Model>,
            { ...options, upsert: true, returnDocument: 'after' }
        );
        return entity as WithId<Model>;
    }

    /** Runs a list of write operations on the collection of a model. */
    async bulkWrite<Model extends EntityInterface>(
        classType: ClassConstructor<Model>,
        operations: Array<AnyBulkWriteOperation<any>>,
        options: BulkWriteOptions = {}
    ): Promise<BulkWriteResult> {
        return await this.write(
            async () => await this.collection(classType).bulkWrite(operations, this.driverOptions(options))
        );
    }

    isIdQuery(query: any): boolean {
        return Object.keys(query).length === 1 && query._id instanceof ObjectId;
    }

    isIdsQuery(query: any): boolean {
        return Object.keys(query).length === 1 && Array.isArray(query._id?.$in);
    }

    protected async deleteCascade<Model extends EntityInterface>(
        classType: ClassConstructor<Model>,
        entity: WithId<Model>,
        options: DeleteEntityOptions
    ) {
        const relationshipsCascades = getRelationshipsCascadesMetadata(classType);

        for (const relationshipCascades of relationshipsCascades) {
            if (!relationshipCascades.cascade.includes(CascadeType.DELETE)) {
                continue;
            }
            const filter =
                relationshipCascades.isArray !== undefined && !relationshipCascades.isArray
                    ? { [relationshipCascades.property]: entity._id }
                    : { _id: { $in: entity[relationshipCascades.property] ?? [] } };
            await this.deleteMany(relationshipCascades.model, filter, {
                hard: options.hard,
                skipHooks: options.skipHooks
            });
        }
    }

    /** Removes (or soft deletes) the documents of some entities, then deletes their cascades. */
    protected async removeEntities<Model extends EntityInterface>(
        classType: ClassConstructor<Model>,
        entities: Array<WithId<Model>>,
        options: DeleteEntityOptions
    ): Promise<DeleteResult> {
        if (entities.length === 0) return { acknowledged: true, deletedCount: 0 };
        if (options.skipHooks !== true) {
            for (const entity of entities) await runHooks(entity, EntityHook.BEFORE_DELETE);
        }

        const filter = { _id: { $in: entities.map((e) => e._id) } } as Filter<Model>;
        const deletedAt = getDeletedAtProperty(classType);
        let deletedCount: number;
        if (deletedAt !== undefined && options.hard !== true) {
            const date = new Date();
            const result = await this.write(
                async () =>
                    await this.collection(classType).updateMany(
                        filter,
                        // the @DeletedAt() property comes from the model metadata
                        { $set: { [deletedAt]: date } } as UpdateFilter<Model>,
                        this.driverOptions(options)
                    )
            );
            deletedCount = result.modifiedCount;
            for (const entity of entities) Reflect.set(entity, deletedAt, date);
        } else {
            const result = await this.write(
                async () => await this.collection(classType).deleteMany(filter, this.driverOptions(options))
            );
            deletedCount = result.deletedCount;
        }

        for (const entity of entities) {
            await this.deleteCascade(classType, entity, options);
            if (options.skipHooks !== true) await runHooks(entity, EntityHook.AFTER_DELETE);
        }
        return { acknowledged: true, deletedCount };
    }

    /**
     * Deletes the first document that matches the filter, after its `@BeforeDelete()` hooks, and deletes its cascades.
     * A model with a `@DeletedAt()` property is soft deleted, unless `hard: true`.
     * Resolves `deletedCount: 0` when no document matches.
     */
    async deleteOne<Model extends EntityInterface>(
        classType: ClassConstructor<Model>,
        query: Filter<Model>,
        options: DeleteEntityOptions = {}
    ): Promise<DeleteResult> {
        this.log('deleteOne %s %o', classType.name, query);
        const entity = await this.findOne<Model>(classType, query, { withDeleted: options.withDeleted });
        return await this.removeEntities(classType, entity !== undefined ? [entity] : [], options);
    }

    /**
     * Deletes all the documents that match the filter, after their `@BeforeDelete()` hooks, and deletes their cascades.
     * A model with a `@DeletedAt()` property is soft deleted, unless `hard: true`.
     */
    async deleteMany<Model extends EntityInterface>(
        classType: ClassConstructor<Model>,
        query: Filter<Model>,
        options: DeleteEntityOptions = {}
    ): Promise<DeleteResult> {
        this.log('deleteMany %s %o', classType.name, query);
        const entities = await (await this.find(classType, query, { withDeleted: options.withDeleted })).toArray();
        return await this.removeEntities(classType, entities, options);
    }

    /**
     * Deletes the first document that matches the filter and returns it as an entity, then deletes its cascades
     * and runs its `@AfterDelete()` hooks. A model with a `@DeletedAt()` property is soft deleted, unless `hard: true`.
     */
    async findOneAndDelete<Model extends EntityInterface>(
        classType: ClassConstructor<Model>,
        query: Filter<Model>,
        options: FindOneAndDeleteEntityOptions = {}
    ): Promise<WithId<Model> | undefined> {
        const deletedAt = getDeletedAtProperty(classType);
        const { hard, skipHooks, ...findOptions } = options;
        let entity: WithId<Model> | undefined;
        if (deletedAt !== undefined && hard !== true) {
            entity = await this.findOneAndUpdate(
                classType,
                query,
                { $set: { [deletedAt]: new Date() } } as UpdateFilter<Model>,
                { ...findOptions, timestamps: false }
            );
        } else {
            const doc = await this.write(
                async () =>
                    await this.collection(classType).findOneAndDelete(this.scopeFilter(classType, query, options), {
                        ...this.driverOptions(options),
                        includeResultMetadata: false
                    })
            );
            entity = doc !== null ? this.hydrate(classType, doc) : undefined;
        }
        if (entity !== undefined) {
            await this.deleteCascade(classType, entity, options);
            if (skipHooks !== true) await runHooks(entity, EntityHook.AFTER_DELETE);
        }
        return entity;
    }

    /**
     * Restores the soft deleted documents that match the filter (for a model with a `@DeletedAt()` property).
     */
    async restore<Model extends EntityInterface>(
        classType: ClassConstructor<Model>,
        query: Filter<Model>,
        options: UpdateEntityOptions = {}
    ): Promise<UpdateResult> {
        const deletedAt = getDeletedAtProperty(classType);
        if (deletedAt === undefined) {
            throw new Error(`restore() requires a @DeletedAt() property on ${classType.name}`);
        }
        return await this.updateMany(
            classType,
            { ...query, [deletedAt]: { $ne: null } } as Filter<Model>,
            { $unset: { [deletedAt]: '' } } as UpdateFilter<Model>,
            options
        );
    }

    /**
     * Opens a change stream on the collection of a model. The stream is closed when the module is destroyed.
     */
    watch<Model extends EntityInterface>(
        classType: ClassConstructor<Model>,
        pipes?: Document[],
        options: ChangeStreamOptions = {}
    ) {
        this.log('watch %o', pipes);
        const stream = this.collection(classType).watch<WithId<Model>>(pipes, this.driverOptions(options));
        this.changeStreams.add(stream);
        stream.once('close', () => this.changeStreams.delete(stream));
        return stream;
    }

    /** Closes the change streams opened with {@link watch}. */
    async closeChangeStreams(): Promise<void> {
        await Promise.all([...this.changeStreams].map(async (stream) => await stream.close()));
        this.changeStreams.clear();
    }

    /** Closes the change streams and the client, and unregisters the manager. */
    async close(): Promise<void> {
        await this.closeChangeStreams();
        await this.client.close();
        if (managers.get(this.getConnectionName()) === this) {
            managers.delete(this.getConnectionName());
        }
    }

    async getRelationship<R extends EntityInterface = any, M extends object = any>(
        obj: M,
        property: Extract<keyof M, string>,
        options: FindEntityOptions = {}
    ): Promise<WithId<R> | undefined> {
        this.log('getRelationship %s on %s', property, obj);
        const relationMetadata = getRelationshipMetadata<R>(obj.constructor, property, this, obj);
        if (isEmpty(relationMetadata)) {
            throw new Error(
                `The property ${property} metadata @Relationship must be set to call getRelationship on ${getObjectName(
                    obj
                )}`
            );
        }

        if (relationMetadata.isArray !== undefined && relationMetadata.isArray) {
            throw new Error(
                `The property ${property} is defined as an array, please use getRelationships instead of getRelationship`
            );
        }

        const id: unknown = obj[property];
        if (!(id instanceof ObjectId)) {
            return;
        }
        return await this.findOne<R>(relationMetadata.type, { _id: id } as Filter<R>, options);
    }

    async getRelationships<R extends EntityInterface = any, M extends object = any>(
        obj: M,
        property: Extract<keyof M, string>,
        options: FindEntityOptions = {}
    ): Promise<Array<WithId<R>>> {
        this.log('getRelationships %s on %s', property, obj);

        const relationMetadata = getRelationshipMetadata<R>(obj.constructor, property, this);
        if (isEmpty(relationMetadata) || relationMetadata === undefined) {
            throw new Error(
                `The property ${property} metadata @Relationship must be set to call getRelationships on ${getObjectName(
                    obj
                )}`
            );
        }

        if (relationMetadata?.isArray !== undefined && !relationMetadata?.isArray) {
            throw new Error(
                `The property ${property} is not defined as an array, please use getRelationship instead of getRelationships in ${getObjectName(
                    obj
                )}`
            );
        }

        const value = obj[property];
        if (!Array.isArray(value)) {
            return [];
        }
        const cursor = await this.find<R>(relationMetadata.type, { _id: { $in: value } } as Filter<R>, options);
        return await cursor.toArray();
    }

    /**
     * Finds the entities that match the filter and loads their relationships, with one aggregation (`$lookup`).
     * The relationships must have a static type (a class or a model name). The soft deleted related documents are
     * ignored, unless `withDeleted: true`.
     *
     * ```ts
     * const [{ entity, relationships }] = await em.findWithRelationships(Child, { _id }, ['parentId']);
     * if (relationships.parentId instanceof Parent) { ... }
     * ```
     */
    async findWithRelationships<Model extends EntityInterface, K extends Extract<keyof Model, string>>(
        classType: ClassConstructor<Model>,
        query: Filter<Model>,
        properties: K[],
        { sort, skip, limit, ...options }: FindWithRelationshipsOptions = {}
    ): Promise<Array<EntityWithRelationships<WithId<Model>, K>>> {
        const relations = properties.map((property) => {
            const metadata = getRelationshipMetadata(classType, property, this);
            return { property, metadata, as: `__relationship_${property}` };
        });

        const pipeline: Document[] = [{ $match: this.scopeFilter(classType, query, options) }];
        if (sort !== undefined) pipeline.push({ $sort: sort });
        if (skip !== undefined) pipeline.push({ $skip: skip });
        if (limit !== undefined) pipeline.push({ $limit: limit });
        for (const { property, metadata, as } of relations) {
            const ids = metadata.isArray === true ? { $ifNull: ['$$ids', []] } : ['$$ids'];
            const deletedAt = getDeletedAtProperty(metadata.type);
            pipeline.push({
                $lookup: {
                    from: this.getCollectionName(metadata.type),
                    let: { ids: `$${property}` },
                    pipeline: [
                        { $match: { $expr: { $in: ['$_id', ids] } } },
                        ...(deletedAt !== undefined && options.withDeleted !== true
                            ? [{ $match: { [deletedAt]: null } }]
                            : [])
                    ],
                    as
                }
            });
        }

        const documents = await this.collection(classType)
            .aggregate<WithId<Document>>(pipeline, this.driverOptions({}))
            .toArray();
        return documents.map((document) => {
            const relationships = {} as EntityWithRelationships<WithId<Model>, K>['relationships'];
            for (const { property, metadata, as } of relations) {
                const lookedUp: unknown = document[as];
                const related = (Array.isArray(lookedUp) ? lookedUp : []).map((doc: WithId<Document>) =>
                    this.hydrate(metadata.type, doc)
                );
                relationships[property] = metadata.isArray === true ? related : related[0];
            }
            // the looked up documents start with __: they are not copied to the entity
            return { entity: this.hydrate(classType, document), relationships };
        });
    }

    /**
     * Loads the relationships of a property for a list of entities, with one query per related model
     * (instead of one query per entity). Returns the related entities by the hexadecimal string of their `_id`.
     *
     * ```ts
     * const parents = await em.populate(children, 'parentId');
     * const parent = parents.get(child.parentId.toHexString());
     * ```
     */
    async populate<R extends EntityInterface = any, M extends object = any>(
        entities: M[],
        property: Extract<keyof M, string>,
        options: FindEntityOptions = {}
    ): Promise<Map<string, WithId<R>>> {
        const idsByType = new Map<ClassConstructor<R>, ObjectId[]>();
        for (const entity of entities) {
            const metadata = getRelationshipMetadata<R>(entity.constructor, property, this, entity);
            const value: unknown = entity[property];
            const ids = (Array.isArray(value) ? value : [value]).filter((v): v is ObjectId => v instanceof ObjectId);
            idsByType.set(metadata.type, [...(idsByType.get(metadata.type) ?? []), ...ids]);
        }
        const related = new Map<string, WithId<R>>();
        for (const [type, ids] of idsByType) {
            if (ids.length === 0) continue;
            for (const item of await this.findByIds(type, ids, options)) {
                related.set(item._id.toHexString(), item);
            }
        }
        return related;
    }

    /**
     * Runs a function in a transaction and returns its result. The function runs in a session context with the
     * session of the transaction, so the operations of the entity manager use it.
     * In a transaction of the same connection, the function runs in this transaction.
     */
    async withTransaction<T>(
        fn: (session: ClientSession) => Promise<T>,
        options: EntityTransactionOptions = {}
    ): Promise<T> {
        const ctx = this.getSessionContext();
        if (ctx !== undefined && ctx.session.inTransaction() && this.sessions.has(ctx.session)) {
            return await fn(ctx.session);
        }
        let result: T;
        await this.startSessionWithTransaction(
            async (session) => {
                result = await fn(session);
            },
            { ...options, useContext: true }
        );
        return result!;
    }

    async startSessionWithTransaction(
        transactionFn: (session: ClientSession) => Promise<any>,
        options: EntityTransactionOptions & { useContext?: boolean } = {}
    ): Promise<ClientSession> {
        const session = this.getClient().startSession(options.sessionOptions ?? {});
        this.sessions.add(session);
        const run = async () => {
            if (options.useContext === true) this.setSessionContext(session);
            try {
                await session.withTransaction(
                    async () => await transactionFn(session),
                    options.transactionOptions ?? {}
                );
            } finally {
                await session.endSession();
            }
        };

        // With useContext, the transaction runs in its own (nested) session context: it works without
        // SessionLoaderMiddleware, and it does not change the session of an outer context.
        await (options.useContext === true ? runInSessionContext(run) : run());

        return session;
    }

    fromPlain<Model extends EntityInterface>(
        classType: ClassConstructor<Model>,
        data: object,
        options?: ClassTransformOptions
    ): Model {
        this.log('transform fromPlain %s', classType.name);
        return fromPlain<Model>(classType, data, options);
    }

    merge<E extends object>(entity: E, data: Partial<E>, excludePrefixes?: string[]): E {
        this.log('%s transform merge', getObjectName(entity));
        return merge(entity, data, excludePrefixes);
    }

    /** The indexes declared on a model (with `@Index()`, `@IsUnique()` and `@Relationship()`), with their names. */
    getIndexDescriptions<Model extends EntityInterface>(model: ClassConstructor<Model>): IndexDescription[] {
        return getIndexMetadatas(model).map((index) => {
            const description = {
                key: index.property !== undefined ? { [index.property]: 1 } : {},
                ...index.description
            } as IndexDescription;
            return { ...description, name: description.name ?? defaultIndexName(description.key) };
        });
    }

    /**
     * Creates the indexes declared on a model.
     * @throws Error when an index can not be created
     */
    async createIndexs<Model extends EntityInterface>(model: ClassConstructor<Model>) {
        this.log('Creating indexs for model %s', model.name);
        const indexes = this.getIndexDescriptions(model);
        if (indexes.length === 0) return;
        const collection = this.getCollection(model);
        try {
            return await collection.createIndexes(indexes, this.driverOptions({}));
        } catch (e) {
            throw Object.assign(
                new Error(`Unable to create index on collection ${collection.namespace}: ${e.message as string}`),
                { cause: e }
            );
        }
    }

    /**
     * Synchronizes the indexes of the collection with the indexes declared on a model: drops the indexes that are
     * not declared, recreates the changed indexes, and creates the missing ones.
     */
    async syncIndexes<Model extends EntityInterface>(model: ClassConstructor<Model>) {
        this.log('Synchronizing indexs for model %s', model.name);
        const collection = this.getCollection(model);
        const declared = this.getIndexDescriptions(model);
        const existing = await collection.listIndexes().toArray();
        const options = ['unique', 'sparse', 'expireAfterSeconds', 'partialFilterExpression'];
        const isSame = (index: Document, description: IndexDescription) =>
            JSON.stringify(index.key) === JSON.stringify(description.key) &&
            options.every((o) => JSON.stringify(index[o] ?? null) === JSON.stringify(description[o] ?? null));

        for (const index of existing) {
            if (index.name === '_id_') continue;
            const description = declared.find((d) => d.name === index.name);
            if (description === undefined || !isSame(index, description)) {
                this.log('Dropping index %s of %s', index.name, collection.namespace);
                await collection.dropIndex(index.name as string);
            }
        }
        return await this.createIndexs(model);
    }
}

export function getModelEntityManager(model: any): EntityManager | undefined {
    const target = typeof model === 'function' ? model : model?.constructor;
    return target !== undefined ? Reflect.getMetadata(MODEL_ENTITY_MANAGER_METADATA_NAME, target) : undefined;
}

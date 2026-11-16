import { NotFoundException } from '@nestjs/common';
import { ClassConstructor, ClassTransformOptions } from 'class-transformer';
import { isEmpty, validate, ValidatorOptions } from 'class-validator';
import Debug from 'debug';
import { unset } from 'lodash';
import {
    ChangeStreamOptions,
    ClientSession,
    ClientSessionOptions,
    CountDocumentsOptions,
    DeleteOptions,
    Document,
    Filter,
    FindCursor,
    FindOptions,
    IndexDescription,
    InsertOneOptions,
    MongoClient,
    ObjectId,
    TransactionOptions,
    UpdateOptions,
    WithId
} from 'mongodb';

import { DEBUG, MODEL_ENTITY_MANAGER_METADATA_NAME } from '../constants';
import { getObjectName } from '../helpers';
import { getIndexMetadatas } from '../indexs';
import { getEntityRepositoryToken, InjectMongoClient } from '../module/injection';
import { ExceptionFactory } from '../module/interfaces';
import { CascadeType } from '../relationship/interfaces';
import {
    getRelationshipMetadata,
    getRelationshipsCascadesMetadata,
    setRelationshipsCascadesMetadata
} from '../relationship/metadata';
import { runInSessionContext } from '../session/context';
import { SessionLoaderService } from '../session/service';
import { fromPlain, merge } from '../transformer/utils';
import { EntityInterface } from './interfaces';
import { EntityRepository } from './repository';

/**
 * The entity manager is the core of the library: every read and write goes through it.
 *
 * One manager exists per connection. Inject it with {@link InjectEntityManager}, or use a
 * repository ({@link EntityRepository}) that delegates to it for a single model.
 *
 * All operations automatically use the mongo session of the current context, if one was set
 * (see {@link EntityManager.startSessionWithTransaction} and {@link SessionLoaderMiddleware}).
 */
export class EntityManager {
    protected readonly repositories: Map<string, any> = new Map();
    protected readonly models: Map<string, ClassConstructor<any>> = new Map();

    protected log = Debug(DEBUG + ':EntityManager');
    constructor(
        @InjectMongoClient()
        protected readonly client: MongoClient,
        protected readonly sessionLoaderService: SessionLoaderService,
        protected readonly exceptionFactory: ExceptionFactory
    ) {}

    /**
     * Register a model on the manager.
     *
     * Creates the collection if it does not exist yet (collections can not be created inside a
     * transaction on older servers), registers relationship cascades and creates the indexes declared
     * with {@link Index}, {@link IsUnique} and {@link Relationship}.
     *
     * Called for you by `MongoModule.forFeature()`.
     */
    async registerModel<Model extends EntityInterface>(
        name: string,
        model: ClassConstructor<Model>
    ): Promise<EntityManager> {
        this.log('Add model %s as %s', model.name, name);
        this.models.set(name, model);
        // the validators (@IsUnique, @IsValidRelationship) use the manager of the connection of the model
        Reflect.defineMetadata(MODEL_ENTITY_MANAGER_METADATA_NAME, this, model);

        // create collection (this will ensure we can directly use transactions, as mongo@=4.2 can not create collection during tx)
        const collectionName = this.getCollectionName(model);
        const cursor = this.getDatabase().listCollections({ name: collectionName });
        if ((await cursor.toArray()).length === 0) {
            this.log('Creating collection %s for model %s', collectionName, name);
            await this.getDatabase().createCollection(collectionName);
        }

        setRelationshipsCascadesMetadata(model, this);
        await this.createIndexs(model);

        return this;
    }

    /**
     * Get a registered model by name (the class name).
     */
    getModel(id: string): ClassConstructor<any> | undefined {
        return this.models.get(id);
    }

    /**
     * Get all the registered models, by name.
     */
    getModels(): Map<string, ClassConstructor<any>> {
        return this.models;
    }

    /**
     * Register a repository instance. Called for you by `MongoModule.forFeature()`.
     */
    registerRepository<Model extends EntityInterface, R extends EntityRepository<Model> = EntityRepository<Model>>(
        name: string,
        repository: R
    ): EntityManager {
        this.log('Add respoitory %s as %s', repository.constructor.name, name);
        this.repositories.set(name, repository);
        return this;
    }

    /**
     * Get the repository of a registered model.
     */
    getRepository<Model extends EntityInterface, R extends EntityRepository<Model> = EntityRepository<Model>>(
        classType: ClassConstructor<Model>
    ): R {
        for (const repository of this.repositories.values()) {
            if (repository.getClassType() === classType) {
                return repository;
            }
        }
        return this.repositories.get(getEntityRepositoryToken(classType.name));
    }

    /**
     * Get the underlying `MongoClient` of the connection.
     */
    getClient(): MongoClient {
        return this.client;
    }

    /**
     * Get a database (the database of the connection uri by default).
     */
    getDatabase(databaseName?: string) {
        return this.client.db(databaseName);
    }

    /**
     * Get the service that stores the mongo session of the current context.
     */
    getSessionLoaderService() {
        return this.sessionLoaderService;
    }

    /**
     * Get the mongo session context of the current async context, if any.
     */
    getSessionContext() {
        return this.sessionLoaderService.getSessionContext();
    }

    /**
     * Set the mongo session to use for all the operations of the current async context.
     * The call must happen inside a session context (see {@link runInSessionContext} and {@link SessionLoaderMiddleware}).
     */
    setSessionContext(mongoSession: ClientSession): void {
        this.sessionLoaderService.setSessionContext(mongoSession);
    }

    /**
     * Remove the mongo session from the current async context.
     */
    clearSessionContext(): void {
        this.sessionLoaderService.clearSessionContext();
    }

    /**
     * Get the collection name of a model or of an entity, as set with {@link Collection}.
     *
     * @throws Error when the class has no `@Collection` decorator
     */
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

    /**
     * Get the native mongodb collection of a model or of an entity.
     */
    getCollection<Model extends EntityInterface>(
        nameOrInstance: Model | ClassConstructor<Model>,
        databaseName?: string
    ) {
        return this.getDatabase(databaseName).collection(this.getCollectionName(nameOrInstance));
    }

    /**
     * Validate an entity with class-validator.
     *
     * Unknown properties are stripped (`whitelist: true`) unless overridden in `validatorOptions`.
     *
     * @param throwError When true, throw the result of the `exceptionFactory` of the module options
     * instead of returning the errors
     * @returns The validation errors (empty when the entity is valid)
     */
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
     * Insert or update an entity.
     *
     * - An entity without `_id` is inserted and receives its new `_id`.
     * - An entity with an `_id` is updated with `$set` (and `updatedAt` is set). Properties explicitly set to
     *   `undefined` are removed with `$unset`.
     *
     * The entity is validated first (unless `skipValidation` is true) and the validation error is
     * thrown using the module `exceptionFactory`.
     *
     * @returns The same entity instance, with its `_id`
     */
    async save<Model extends EntityInterface>(
        entity: Model | WithId<Model>,
        options: (InsertOneOptions | UpdateOptions) & {
            skipValidation?: boolean;
            validatorOptions?: ValidatorOptions;
        } = {}
    ): Promise<WithId<Model>> {
        const entityName = entity.constructor.name;
        const ctx = this.getSessionContext();
        try {
            this.log('saving %s', entityName);
            const collection = this.getCollection(entity);
            const Model = this.getModel(entityName);
            if (Model === undefined) {
                throw new Error(`Can not find model ${entityName}`);
            }
            const proxy = this.merge(new Model(), entity);

            if (options.skipValidation !== true) {
                await this.validate(proxy, options.validatorOptions, true);
            }

            const operationOptions = {
                ...(ctx !== undefined ? { session: ctx.session } : {}),
                ...options
            };

            if (!isEmpty(proxy._id)) {
                proxy.updatedAt = new Date();
                const $unset: any = {};
                // must be done in a recursive way to allow to delete props from subobject
                for (const p in entity) {
                    if (Object.prototype.hasOwnProperty.call(proxy, p) === true) {
                        const v: any = proxy[p];
                        if (v === undefined) {
                            $unset[p] = 1;
                            unset(proxy, p);
                        }
                    }
                }
                const sets: any = { $set: proxy };
                if (Object.keys($unset).length > 0) {
                    sets.$unset = $unset;
                }
                await collection.updateOne({ _id: proxy._id }, sets, {
                    upsert: false,
                    ...operationOptions
                });
            } else {
                const { insertedId } = await collection.insertOne(proxy, {
                    ...operationOptions
                });

                if (insertedId instanceof ObjectId) {
                    proxy._id = insertedId;
                }
            }

            // merge the proxy changes back to the entity
            this.merge(entity, proxy);

            this.log('%s %s saved', Model.name, entity._id?.toHexString());
            return entity as WithId<Model>;
        } catch (e) {
            this.log('error saving %s', entityName);
            throw e;
        }
    }

    /**
     * Find entities. Returns a native mongodb cursor that yields model instances.
     */
    async find<Model extends EntityInterface>(
        classType: ClassConstructor<Model>,
        query: Filter<Model>,
        options: FindOptions = {}
    ): Promise<FindCursor<WithId<Model>>> {
        this.log('find %s %o', classType.name, query);
        const ctx = this.getSessionContext();
        const cursor = this.getCollection(classType).find(query, {
            ...(ctx !== undefined ? { session: ctx.session } : {}),
            ...options
        });
        return cursor.map((data) => this.fromPlain(classType, data) as WithId<Model>);
    }

    /**
     * Find one entity.
     *
     * @returns The model instance, or `undefined` when nothing matches
     */
    async findOne<Model extends EntityInterface>(
        classType: ClassConstructor<Model>,
        query: Filter<Model>,
        options: FindOptions = {}
    ): Promise<WithId<Model> | undefined> {
        this.log('findOne %s %o', classType.name, query, options);
        const ctx = this.getSessionContext();
        const obj = await this.getCollection(classType).findOne(query, {
            ...(ctx !== undefined ? { session: ctx.session } : {}),
            ...options
        });
        if (obj !== null) {
            return this.fromPlain<Model>(classType, obj) as WithId<Model>;
        }
    }

    /**
     * Count the documents matching a query (uses `countDocuments`).
     */
    async count<Model extends EntityInterface>(
        classType: ClassConstructor<Model>,
        query: Filter<Model>,
        options: CountDocumentsOptions = {}
    ): Promise<number> {
        this.log('count %s %o', classType.name, query);
        const ctx = this.getSessionContext();
        const collection = this.getCollection(classType);
        return await collection.countDocuments(query, {
            ...(ctx !== undefined ? { session: ctx.session } : {}),
            ...options
        });
    }

    /**
     * Returns true when the query is exactly `{ _id: ObjectId }`.
     */
    isIdQuery(query: any): boolean {
        return Object.keys(query).length === 1 && query._id instanceof ObjectId;
    }

    /**
     * Returns true when the query is exactly `{ _id: { $in: [...] } }`.
     */
    isIdsQuery(query: any): boolean {
        return Object.keys(query).length === 1 && Array.isArray(query._id?.$in);
    }

    protected async deleteCascade<Model extends EntityInterface>(
        classType: ClassConstructor<Model>,
        entity: WithId<Model>
    ) {
        const relationshipsCascades = getRelationshipsCascadesMetadata(classType);

        if (!Array.isArray(relationshipsCascades)) {
            return;
        }
        for (const relationshipCascades of relationshipsCascades) {
            if (!relationshipCascades.cascade.includes(CascadeType.DELETE)) {
                continue;
            }
            if (relationshipCascades.isArray !== undefined && !relationshipCascades.isArray) {
                await this.deleteMany(relationshipCascades.model, {
                    [relationshipCascades.property]: entity._id
                });
            } else {
                await this.deleteMany(relationshipCascades.model, {
                    _id: { $in: entity[relationshipCascades.property] }
                });
            }
        }
    }

    /**
     * Delete one entity, then run the delete cascades of its relationships.
     *
     * @throws NotFoundException when nothing matches the query
     */
    async deleteOne<Model extends EntityInterface>(
        classType: ClassConstructor<Model>,
        query: Filter<Model>,
        options: DeleteOptions = {}
    ) {
        this.log('deleteOne %s %o', classType.name, query);
        const ctx = this.getSessionContext();
        const entity = await this.findOne<Model>(classType, query);

        if (entity === undefined) {
            throw new NotFoundException();
        }

        const result = await this.getCollection(classType).deleteOne(
            { _id: entity._id },
            {
                ...(ctx !== undefined ? { session: ctx.session } : {}),
                ...options
            }
        );

        await this.deleteCascade(classType, entity);

        return result;
    }

    /**
     * Delete all the entities matching a query, then run the delete cascades of their relationships.
     */
    async deleteMany<Model extends EntityInterface>(
        classType: ClassConstructor<Model>,
        query: Filter<Model>,
        options: DeleteOptions = {}
    ) {
        this.log('deleteMany %s %o', classType.name, query);
        const ctx = this.getSessionContext();
        const items = await this.find(classType, query, options);

        // get a ref of entities that are going to be deleted before to delete them
        const entities = await items.toArray();

        const result = await this.getCollection(classType).deleteMany(query, {
            ...(ctx !== undefined ? { session: ctx.session } : {}),
            ...options
        });

        for (const entity of entities) {
            await this.deleteCascade(classType, entity);
        }

        return result;
    }

    /**
     * Open a change stream on the collection of a model (requires a replica set).
     */
    watch<Model extends EntityInterface>(
        classType: ClassConstructor<Model>,
        pipes?: Document[],
        options: ChangeStreamOptions = {}
    ) {
        this.log('watch %o', pipes);
        const ctx = this.getSessionContext();
        return this.getCollection(classType).watch<WithId<Model>>(pipes, {
            ...(ctx !== undefined ? { session: ctx.session } : {}),
            ...options
        });
    }

    /**
     * Load the entity referenced by a single {@link Relationship} property.
     *
     * @returns The related entity, or `undefined` when the property is not set or the entity does not exist
     * @throws Error when the property is not a relationship, or is declared with `isArray: true`
     */
    async getRelationship<R extends EntityInterface = any>(
        obj: any,
        property: string,
        options: FindOptions = {}
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

        const id: ObjectId | undefined | null = obj[property];
        if (!(id instanceof ObjectId)) {
            return;
        }
        const filter = { _id: id } as Filter<R>;
        const relationship = await this.findOne<R>(relationMetadata.type, filter, options);

        return relationship;
    }

    /**
     * Load the entities referenced by an array {@link Relationship} property (`isArray: true`).
     *
     * @returns The related entities (an empty array when the property is not set)
     * @throws Error when the property is not an array relationship
     */
    async getRelationships<R extends EntityInterface = any>(
        obj: any,
        property: string,
        options: FindOptions = {}
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
        const relationshipsCursor = await this.find<R>(
            relationMetadata.type,
            {
                _id: { $in: value }
            },
            options
        );

        return await relationshipsCursor.toArray();
    }

    /**
     * Start a session and run `transactionFn` in a transaction (with automatic retries, see
     * `ClientSession.withTransaction` in the mongodb driver).
     *
     * With `useContext: true`, the session is set on a new session context for the duration of `transactionFn`,
     * so every operation of the manager (and of the validators) made inside it uses the session without passing
     * it as an option. No middleware is required.
     *
     * To avoid Transaction Errors, it is important to keep a sequential approach in the way transactions are commited to the session.
     * ie: do not to use Promise.all (parallel execution) in your transaction function as it could cause inconsistencies in the order
     * in which transactions will be committed to the session.
     */
    async startSessionWithTransaction(
        transactionFn: (session: ClientSession) => Promise<any>,
        options: {
            useContext?: boolean;
            transactionOptions?: TransactionOptions;
            sessionOptions?: ClientSessionOptions;
        } = {}
    ): Promise<ClientSession> {
        const session = this.getClient().startSession(options.sessionOptions ?? {});
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

    /**
     * Transform a plain object (for example a mongo document or a request body) to a model instance.
     */
    fromPlain<Model extends EntityInterface>(
        classType: ClassConstructor<Model>,
        data: object,
        options?: ClassTransformOptions
    ): Model {
        this.log('transform fromPlain %s', classType.name);
        return fromPlain<Model>(classType, data, options);
    }

    /**
     * Deep merge `data` into `entity`. `undefined` values in `data` do not override values of `entity`.
     */
    merge<Model extends EntityInterface>(entity: Model, data: Model, excludePrefixes?: string[]) {
        this.log('%s transform merge', getObjectName(entity));
        return merge(entity, data, excludePrefixes);
    }

    /**
     * Create the indexes declared on a model. Called for you by {@link EntityManager.registerModel}.
     * Errors are logged, not thrown.
     */
    async createIndexs<Model extends EntityInterface>(model: ClassConstructor<Model>) {
        this.log('Creating indexs for model %s', model.name);
        const indexesMetadata = getIndexMetadatas(model);
        const collection = this.getCollection(model);

        if (indexesMetadata !== undefined) {
            const createIndexs: IndexDescription[] = [];
            for (const index of indexesMetadata) {
                let indexDescription: IndexDescription = {
                    key: {
                        [index.property]: 1
                    }
                };
                if (index.description !== undefined) {
                    indexDescription = { ...indexDescription, ...index.description };
                }
                createIndexs.push(indexDescription);
            }
            if (createIndexs.length > 0) {
                try {
                    return await collection.createIndexes(createIndexs);
                } catch (e) {
                    console.error(
                        new Error(`Unable to create index on collection ${collection.namespace} ${e.message as string}`)
                    );
                }
            }
        }
    }
}

/**
 * Get the entity manager a model was registered on (with `MongoModule.forFeature()`).
 *
 * @param model A model class, or an instance of a model
 */
export function getModelEntityManager(model: any): EntityManager | undefined {
    const target = typeof model === 'function' ? model : model?.constructor;
    return target !== undefined ? Reflect.getMetadata(MODEL_ENTITY_MANAGER_METADATA_NAME, target) : undefined;
}

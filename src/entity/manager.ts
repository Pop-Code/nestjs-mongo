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
} from 'mongodb';

import { DEBUG } from '../constants';
import { getObjectName } from '../helpers';
import { getIndexMetadatas } from '../indexs';
import { getEntityRepositoryToken, InjectMongoClient } from '../module/injection';
import { ExceptionFactory } from '../module/interfaces';
import { CascadeType } from '../relationship/interfaces';
import {
    getRelationshipMetadata,
    getRelationshipsCascadesMetadata,
    setRelationshipsCascadesMetadata,
} from '../relationship/metadata';
import { SessionLoaderService } from '../session/service';
import { fromPlain, merge } from '../transformer/utils';
import { EntityInterface } from './interfaces';
import { EntityRepository } from './repository';

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

    async registerModel<Model extends EntityInterface>(
        name: string,
        model: ClassConstructor<Model>
    ): Promise<EntityManager> {
        this.log('Add model %s as %s', model.name, name);
        this.models.set(name, model);

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

    getModel(id: string): ClassConstructor<any> | undefined {
        return this.models.get(id);
    }

    getModels(): Map<string, ClassConstructor<any>> {
        return this.models;
    }

    registerRepository<Model extends EntityInterface, R extends EntityRepository<Model> = EntityRepository<Model>>(
        name: string,
        repository: R
    ): EntityManager {
        this.log('Add respoitory %s as %s', repository.constructor.name, name);
        this.repositories.set(name, repository);
        return this;
    }

    getRepository<Model extends EntityInterface, R extends EntityRepository<Model> = EntityRepository<Model>>(
        classType: ClassConstructor<Model>
    ): R {
        return this.repositories.get(getEntityRepositoryToken(classType.name));
    }

    getClient(): MongoClient {
        return this.client;
    }

    getDatabase(databaseName?: string) {
        return this.client.db(databaseName);
    }

    getSessionLoaderService() {
        return this.sessionLoaderService;
    }

    getSessionContext() {
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
    ) {
        return this.getDatabase(databaseName).collection(this.getCollectionName(nameOrInstance));
    }

    async validate(obj: any, validatorOptions: ValidatorOptions = {}, throwError: boolean = false) {
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

    async save<Model extends EntityInterface>(
        entity: Model,
        options: (InsertOneOptions | UpdateOptions) & {
            skipValidation?: boolean;
            validatorOptions?: ValidatorOptions;
        } = {}
    ): Promise<Model> {
        const entityName = entity.constructor.name;
        const ctx = this.getSessionContext();
        try {
            this.log('saving %s', entityName);
            if (options.skipValidation !== true) {
                await this.validate(entity, options.validatorOptions, true);
            }
            const collection = this.getCollection(entity);

            const Model = this.getModel(entityName);
            if (Model === undefined) {
                throw new Error(`Can not find model ${entityName}`);
            }
            const proxy = new Model();
            this.merge(proxy, entity);

            const operationOptions = {
                ...(ctx !== undefined ? { session: ctx.session } : {}),
                ...options
            };

            if (!isEmpty(proxy._id)) {
                proxy.updatedAt = new Date();
                const $unset: any = {};
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

            this.log('%s %s saved', Model.name, entity._id.toHexString());
            return entity;
        } catch (e) {
            this.log('error saving %s', entityName);
            throw e;
        }
    }

    async find<Model extends EntityInterface>(
        classType: ClassConstructor<Model>,
        query: Filter<Model>,
        options: FindOptions<Model> = {}
    ): Promise<FindCursor<Model>> {
        this.log('find %s %o', classType.name, query);
        const ctx = this.getSessionContext();
        const cursor = this.getCollection(classType).find(query, {
            ...(ctx !== undefined ? { session: ctx.session } : {}),
            ...options
        });
        return cursor.map((data) => {
            const entity = this.fromPlain<Model>(classType, data);
            return entity;
        });
    }

    async findOne<Model extends EntityInterface>(
        classType: ClassConstructor<Model>,
        query: Filter<Model>,
        options: FindOptions = {}
    ): Promise<Model | undefined> {
        this.log('findOne %s %o', classType.name, query, options);
        const ctx = this.getSessionContext();
        const obj = await this.getCollection(classType).findOne(query, {
            ...(ctx !== undefined ? { session: ctx.session } : {}),
            ...options
        });
        if (obj !== undefined) {
            return this.fromPlain<Model>(classType, obj);
        }
    }

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

    isIdQuery(query: any): boolean {
        return Object.keys(query).length === 1 && query._id;
    }

    isIdsQuery(query: any): boolean {
        return this.isIdQuery(query) && Array.isArray(query._id.$in);
    }

    protected async deleteCascade<Model extends EntityInterface>(classType: ClassConstructor<Model>, entity: Model) {
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

    async deleteMany<Model extends EntityInterface>(
        classType: ClassConstructor<Model>,
        query: any,
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

    watch<Model extends EntityInterface>(
        classType: ClassConstructor<Model>,
        pipes?: Document[],
        options: ChangeStreamOptions = {}
    ) {
        this.log('watch %o', pipes);
        const ctx = this.getSessionContext();
        return this.getCollection(classType).watch<Model>(pipes, {
            ...(ctx !== undefined ? { session: ctx.session } : {}),
            ...options
        });
    }

    async getRelationship<R extends EntityInterface = any>(
        obj: any,
        property: string,
        options: FindOptions = {}
    ): Promise<R | undefined> {
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

        const value = obj[property];
        const relationship = await this.findOne<R>(relationMetadata.type, { _id: value }, options);

        return relationship;
    }

    async getRelationships<R extends EntityInterface = any>(
        obj: any,
        property: string,
        options: FindOptions = {}
    ): Promise<Array<R | Error>> {
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
        const relationshipsCursor = await this.find(
            relationMetadata.type,
            {
                _id: { $in: value }
            },
            options
        );

        return await relationshipsCursor.toArray();
    }

    /**
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
        const useContext = options.useContext === true;
        useContext && this.setSessionContext(session);

        try {
            await session.withTransaction(async () => await transactionFn(session), options.transactionOptions ?? {});
        } finally {
            useContext && this.clearSessionContext();
            await session.endSession();
        }

        return session;
    }

    fromPlain<Model extends EntityInterface>(
        classType: ClassConstructor<Model>,
        data: object,
        options?: ClassTransformOptions
    ) {
        this.log('transform fromPlain %s', classType.name);
        return fromPlain(classType, data, options);
    }

    merge<Model extends EntityInterface>(entity: Model, data: Model, options?: ClassTransformOptions) {
        this.log('%s transform merge', getObjectName(entity));
        return merge(entity, data, options);
    }

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

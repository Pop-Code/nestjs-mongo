import { validate } from 'class-validator';
import Debug from 'debug';
import {
    ChangeStream,
    CommonOptions,
    Cursor,
    FindOneOptions,
    MongoClient,
    MongoCountPreferences,
    ObjectId
} from 'mongodb';
import { DEBUG } from './constants';
import { InjectMongoClient } from './decorators';
import { getRepositoryToken, getDataloaderToken } from './helpers';
import { EntityInterface } from './interfaces/entity';
import { ExceptionFactory } from './interfaces/exception';
import { MongoExecutionOptions } from './interfaces/execution.options';
import { MongoRepository } from './repository';
import { ClassType } from 'class-transformer/ClassTransformer';
import {
    plainToClass,
    ClassTransformOptions,
    classToClassFromExist
} from 'class-transformer';
import {
    getRelationshipMetadata,
    RelationshipMetadata
} from './relationship/metadata';
import { WithRelationshipInterface } from './relationship/decorators';
import DataLoader from 'dataloader';
import { DataloaderService } from './dataloader/service';

export class MongoManager {
    protected readonly repositories: Map<string, any> = new Map();
    protected log = Debug(DEBUG + ':MongoManager');
    constructor(
        @InjectMongoClient()
        protected readonly client: MongoClient,
        protected readonly dataloaderService: DataloaderService,
        protected readonly exceptionFactory: ExceptionFactory
    ) {}

    addRepository<
        Model extends EntityInterface,
        R extends MongoRepository<Model> = MongoRepository<Model>
    >(token: string, repository: R): MongoManager {
        this.log('Add respoitory %s %s', token, repository.constructor.name);
        this.repositories.set(token, repository);
        return this;
    }

    getRepository<
        Model extends EntityInterface,
        R extends MongoRepository<Model> = MongoRepository<Model>
    >(classType: ClassType<Model>): R {
        return this.repositories.get(getRepositoryToken(classType.name));
    }

    getClient(): MongoClient {
        return this.client;
    }

    getDatabase(databaseName?: string) {
        return this.client.db(databaseName);
    }

    getCollectionName<Model>(nameOrInstance: Model | ClassType<Model>): string {
        let name: string;
        if (
            typeof nameOrInstance === 'object' ||
            typeof nameOrInstance === 'function'
        ) {
            name = Reflect.getMetadata(
                'mongo:collectionName',
                typeof nameOrInstance === 'object'
                    ? nameOrInstance.constructor
                    : nameOrInstance
            );
        }

        if (!name) {
            throw new Error(
                '@Collection decorator is required to use a class as model for:' +
                    nameOrInstance
            );
        }

        return name;
    }

    getCollection<Model extends EntityInterface>(
        nameOrInstance: Model | ClassType<Model>,
        databaseName?: string
    ) {
        return this.getDatabase(databaseName).collection(
            this.getCollectionName(nameOrInstance)
        );
    }

    async save<Model extends EntityInterface>(
        entity: Model,
        options: MongoExecutionOptions & { dataloader?: string } = {}
    ): Promise<Model> {
        try {
            this.log('save %s %s', entity.constructor.name);
            const errors = await validate(entity, {
                whitelist: true,
                validationError: { target: true, value: true }
            });
            if (errors.length) {
                throw this.exceptionFactory(errors);
            }

            const collection = this.getCollection(entity, options.database);
            let operation: any;
            if (entity._id) {
                entity.updatedAt = new Date();

                const $unset: any = {};
                for (const p in entity) {
                    if (entity.hasOwnProperty(p)) {
                        const v: any = entity[p];
                        if (v === undefined) {
                            $unset[p] = 1;
                            delete entity[p];
                        }
                    }
                }

                const sets: any = { $set: entity };

                if (Object.keys($unset).length) {
                    sets.$unset = $unset;
                }

                operation = collection.updateOne({ _id: entity._id }, sets, {
                    upsert: false,
                    ...options.mongoOperationOptions
                });
            } else {
                operation = collection.insertOne(
                    entity,
                    options.mongoOperationOptions
                );
            }
            const { result, insertedId } = await operation;
            if (!result.ok) {
                throw new Error('Unknow Error during entity save');
            }

            // new id
            if (insertedId) {
                entity._id = insertedId;
            }

            const dataloader = this.getDataloader(options.dataloader);
            if (dataloader) {
                this.log(
                    'Updating dataloader %s %s',
                    entity.constructor.name,
                    entity._id
                );
                dataloader.clear(entity._id).prime(entity._id, entity);
            }
            return entity;
        } catch (e) {
            const dataloader = this.getDataloader(options.dataloader);
            if (dataloader) {
                this.log(
                    'Clearing dataloader %s %s',
                    entity.constructor.name,
                    entity._id
                );
                dataloader.clear(entity._id);
            }
            throw e;
        }
    }

    getDataloader<Model extends EntityInterface>(id: string) {
        if (!id) {
            return;
        }
        return this.dataloaderService.get<Model>(id);
    }

    async find<Model extends EntityInterface>(
        classType: ClassType<Model>,
        query: any,
        options: { dataloader?: string } = {}
    ): Promise<Cursor<Model>> {
        this.log('find %s %o', classType.name, query);
        const cursor: Cursor<Object> = await this.getCollection(classType).find(
            query
        );
        const dataloader = this.getDataloader(options.dataloader);
        return cursor.map(entity => {
            const instance = this.fromPlain<Model>(classType, entity);
            if (dataloader) {
                this.log(
                    'Updating dataloader object id %s on %s',
                    instance._id,
                    classType.name
                );
                dataloader.clear(instance._id).prime(instance._id, instance);
            }
            return instance;
        });
    }

    async findOne<Model extends EntityInterface>(
        classType: ClassType<Model>,
        query: any,
        options: FindOneOptions & { dataloader?: string } = {}
    ): Promise<Model> {
        this.log('findOne %s %o', classType.name, query);
        let entity: Model;
        const dataloader = this.getDataloader<Model>(options.dataloader);
        if (dataloader && this.isIdQuery(query)) {
            this.log('findOne delegated to dataloader');
            entity = await dataloader.load(query._id);
        }
        if (!entity) {
            const obj = await this.getCollection(classType).findOne<Object>(
                query,
                options
            );
            if (!obj) {
                return null;
            }
            entity = this.fromPlain<Model>(classType, obj);
        }

        if (dataloader) {
            this.log('Updating dataloader %s', classType.name);
            dataloader.clear(entity._id).prime(entity._id, entity);
        }

        return entity;
    }

    async count<Model extends EntityInterface>(
        classType: ClassType<Model>,
        query: any,
        options?: MongoCountPreferences
    ): Promise<number> {
        this.log('count %s %o', classType.name, query);
        return await this.getCollection(classType).countDocuments(
            query,
            options
        );
    }

    isIdQuery(query: any): boolean {
        return Object.keys(query).length === 1 && query._id;
    }
    isIdsQuery(query: any): boolean {
        return this.isIdQuery(query) && Array.isArray(query._id.$in);
    }

    async deleteOne<Model extends EntityInterface>(
        classType: ClassType<Model>,
        query: any,
        options: CommonOptions & { dataloader?: string } = {}
    ) {
        this.log('deleteOne %s %o', classType.name, query);
        const result = await this.getCollection(classType).deleteOne(
            query,
            options
        );
        const dataloader = this.getDataloader<Model>(options.dataloader);
        if (dataloader && this.isIdQuery(query)) {
            dataloader.clear(query._id);
        }
        return result;
    }

    watch<Model extends EntityInterface>(
        classType: ClassType<Model>,
        pipes?: any[],
        options?: any
    ): ChangeStream {
        this.log('watch %o', pipes);
        return this.getCollection(classType).watch(pipes, options);
    }

    async getRelationship<
        Relationship extends EntityInterface = any,
        Model extends EntityInterface & WithRelationshipInterface = any
    >(
        object: Model,
        property: string,
        options: {
            cachedMetadata?: RelationshipMetadata<Relationship, Model>;
            dataloader?: string;
        } = {}
    ): Promise<Relationship> {
        this.log('getRelationship %s on %s', property, object.constructor.name);

        let relationMetadata = options && options.cachedMetadata;
        if (!relationMetadata) {
            relationMetadata = getRelationshipMetadata<Relationship, Model>(
                object,
                property
            );
            if (!relationMetadata) {
                throw new Error(
                    `The property ${property} metadata @Relationship must be set to call getRelationship on ${object.constructor.name}`
                );
            }
        }

        if (relationMetadata.isArray) {
            throw new Error(
                `The property ${property} is defined as an array, please use getRelationships instead of getRelationship`
            );
        }

        const repository = this.getRepository(relationMetadata.type);
        const value = object[property];
        const relationship = await repository.findOne(
            {
                _id: value
            },
            { dataloader: options.dataloader }
        );

        if (
            relationship &&
            typeof object.setCachedRelationship === 'function'
        ) {
            object.setCachedRelationship(property, relationship);
        }

        return relationship;
    }

    async getRelationships<
        Relationship extends EntityInterface = any,
        Model extends EntityInterface & WithRelationshipInterface = any
    >(
        object: Model,
        property: string,
        options: {
            cachedMetadata?: RelationshipMetadata<Relationship, Model>;
            dataloader?: string;
        } = {}
    ): Promise<Relationship[]> {
        this.log(
            'getRelationships %s on %s',
            property,
            object.constructor.name
        );
        let relationMetadata = options && options.cachedMetadata;
        if (!relationMetadata) {
            relationMetadata = getRelationshipMetadata<Relationship, Model>(
                object,
                property
            );
            if (!relationMetadata) {
                throw new Error(
                    `The property ${property} metadata @Relationship must be set to call getRelationships on ${object.constructor.name}`
                );
            }
        }

        if (!relationMetadata.isArray) {
            throw new Error(
                `The property ${property} is not defined as an array, please use getRelationship instead of getRelationships in ${object.constructor.name}`
            );
        }

        const repository = this.getRepository(relationMetadata.type);
        const value = object[property];
        const relationships = await repository.findById(value, {
            dataloader: options.dataloader
        });
        if (
            relationships &&
            typeof object.setCachedRelationship === 'function'
        ) {
            object.setCachedRelationship(property, relationships);
        }

        return relationships;
    }

    fromPlain<Model extends EntityInterface>(
        classType: ClassType<Model>,
        data: Object,
        options?: ClassTransformOptions
    ): Model {
        this.log('transform fromPlain %s', classType.name);
        return plainToClass(classType, data, {
            ...options,
            excludePrefixes: ['__']
        });
    }

    merge<Model extends EntityInterface>(
        entity: Model,
        data: any,
        options?: ClassTransformOptions
    ): Model {
        this.log('%s transform merge', entity.constructor.name);
        return classToClassFromExist(data, entity, {
            ...options,
            excludePrefixes: ['__']
        });
    }

    createDataLoader<Model extends EntityInterface>(model: ClassType<Model>) {
        const log = this.log.extend('Dataloader:' + model.name);
        return new DataLoader<ObjectId, Model>(
            async keys => {
                log('find', keys);
                const cursor = await this.find(model, { _id: { $in: keys } });
                return await cursor.toArray();
            },
            {
                batch: true,
                maxBatchSize: 500,
                cache: true,
                cacheKeyFn: (key: ObjectId) => key.toString()
            }
        );
    }
}

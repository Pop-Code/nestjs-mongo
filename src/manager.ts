import { NotFoundException } from '@nestjs/common';
import {
    classToClassFromExist,
    ClassTransformOptions,
    plainToClass
} from 'class-transformer';
import { ClassType } from 'class-transformer/ClassTransformer';
import { validate } from 'class-validator';
import Debug from 'debug';
import {
    ChangeStream,
    CommonOptions,
    Cursor,
    FindOneOptions,
    MongoClient,
    MongoCountPreferences
} from 'mongodb';

import { DEBUG } from './constants';
import { DataloaderService } from './dataloader/service';
import { InjectMongoClient } from './decorators';
import { getRepositoryToken } from './helpers';
import { EntityInterface } from './interfaces/entity';
import { ExceptionFactory } from './interfaces/exception';
import { MongoExecutionOptions } from './interfaces/execution.options';
import { WithRelationshipInterface } from './relationship/decorators';
import {
    getRelationshipMetadata,
    RelationshipMetadata
} from './relationship/metadata';
import { MongoRepository } from './repository';

export class MongoManager {
    protected readonly repositories: Map<string, any> = new Map();
    protected readonly models: Map<string, ClassType<any>> = new Map();

    protected log = Debug(DEBUG + ':MongoManager');
    constructor(
        @InjectMongoClient()
        protected readonly client: MongoClient,
        protected readonly dataloaderService: DataloaderService,
        protected readonly exceptionFactory: ExceptionFactory
    ) {}

    registerModel<Model extends EntityInterface>(
        name: string,
        model: ClassType<Model>
    ): MongoManager {
        this.log('Add model %s as %s', model.name, name);
        this.models.set(name, model);
        return this;
    }

    getModel(id: string): ClassType<any> {
        return this.models.get(id);
    }

    getModels(): Map<string, ClassType<any>> {
        return this.models;
    }

    registerRepository<
        Model extends EntityInterface,
        R extends MongoRepository<Model> = MongoRepository<Model>
    >(name: string, repository: R): MongoManager {
        this.log('Add respoitory %s as %s', repository.constructor.name, name);
        this.repositories.set(name, repository);
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

    getDataloaderService() {
        return this.dataloaderService;
    }

    getDataloader<Model extends EntityInterface>(id: string) {
        return this.dataloaderService.get<Model>(id);
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
        const entityName = entity.constructor.name;
        try {
            this.log('saving %s', entityName);
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

            this.dataloaderService.update(
                options.dataloader || entityName,
                entity
            );

            return entity;
        } catch (e) {
            this.log('error saving %s', entityName);

            if (entity._id) {
                this.dataloaderService.delete(
                    options.dataloader || entityName,
                    entity
                );
            }

            throw e;
        }
    }

    async find<Model extends EntityInterface>(
        classType: ClassType<Model>,
        query: any,
        options: { dataloader?: string } = {}
    ): Promise<Cursor<Model>> {
        this.log('find %s %o', classType.name, query);
        const cursor: Cursor<object> = await this.getCollection(classType).find(
            query
        );
        const cursorMap = cursor.map((data) => {
            const entity = this.fromPlain<Model>(classType, data);
            return entity;
        });
        this.dataloaderService.updateAll(
            options.dataloader || classType.name,
            cursorMap
        );
        return cursorMap;
    }

    async findOne<Model extends EntityInterface>(
        classType: ClassType<Model>,
        query: any,
        options: FindOneOptions & { dataloader?: string } = {}
    ): Promise<Model> {
        this.log('findOne %s %o', classType.name, query);
        let entity: Model;
        const dataloader = this.getDataloader<Model>(
            options.dataloader || classType.name
        );
        if (dataloader && this.isIdQuery(query)) {
            this.log('findOne delegated to dataloader %s', dataloader.uuid);
            entity = await dataloader.load(query._id);
        }
        if (!entity) {
            const obj = await this.getCollection(classType).findOne<object>(
                query,
                options
            );
            if (!obj) {
                return null;
            }
            entity = this.fromPlain<Model>(classType, obj);
        }

        if (dataloader) {
            this.log(
                'Updating dataloader %s %s %s',
                dataloader.uuid,
                classType.name,
                entity._id
            );
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
        const entity = await this.findOne<Model>(classType, query);
        if (!entity) {
            throw new NotFoundException();
        }
        const result = await this.getCollection(classType).deleteOne(
            { _id: entity._id },
            options
        );
        this.dataloaderService.delete(
            options.dataloader || classType.name,
            entity
        );
        return result;
    }

    async deleteMany<Model extends EntityInterface>(
        classType: ClassType<Model>,
        query: any,
        options: CommonOptions & { dataloader?: string } = {}
    ) {
        this.log('deleteMany %s %o', classType.name, query);
        const items = await this.find(classType, query, options);
        const result = await this.getCollection(classType).deleteMany(
            query,
            options
        );
        const dataloader = await this.getDataloader<Model>(
            options.dataloader || classType.name
        );
        if (dataloader && items.count) {
            items.forEach((i) => dataloader.clear(i._id));
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
        O extends WithRelationshipInterface = any
    >(
        object: O,
        property: string,
        options: {
            cachedMetadata?: RelationshipMetadata<Relationship, O>;
            dataloader?: string;
        } = {}
    ): Promise<Relationship> {
        this.log('getRelationship %s on %s', property, object.constructor.name);

        let relationMetadata = options && options.cachedMetadata;
        if (!relationMetadata) {
            relationMetadata = getRelationshipMetadata<Relationship, O>(
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
        const relationship = await repository.findOne({
            _id: value
        });

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
        O extends WithRelationshipInterface = any
    >(
        object: O,
        property: string,
        options: {
            cachedMetadata?: RelationshipMetadata<Relationship, O>;
            dataloader?: string;
        } = {}
    ): Promise<Array<Relationship | Error>> {
        this.log(
            'getRelationships %s on %s',
            property,
            object.constructor.name
        );
        let relationMetadata = options && options.cachedMetadata;
        if (!relationMetadata) {
            relationMetadata = getRelationshipMetadata<Relationship, O>(
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
        const relationships = await repository.findById(value);
        if (
            relationships &&
            typeof object.setCachedRelationship === 'function'
        ) {
            object.setCachedRelationship(property, relationships);
        }

        return relationships;
    }

    async getInversedRelationships<
        P extends EntityInterface = any,
        C extends EntityInterface = any
    >(parent: P, childType: ClassType<C>, property: string) {
        let relationMetadata: RelationshipMetadata<P, C>;
        if (!relationMetadata) {
            relationMetadata = getRelationshipMetadata<P, C>(
                new childType(), // fix typing
                property
            );
            if (!relationMetadata) {
                throw new Error(
                    `The property ${property} metadata @Relationship must be set to call getInversedRelationships of ${parent.constructor.name}`
                );
            }
        }

        if (!relationMetadata.inversedBy) {
            throw new Error(`Can not get inversed metadata`);
        }

        const repository = this.getRepository(childType);
        // todo set metadata for inversed side insted of using implicit _id ? ?
        const children = await repository.find({
            [property]: parent._id
        });

        return children;
    }

    fromPlain<Model extends EntityInterface>(
        classType: ClassType<Model>,
        data: object,
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
}

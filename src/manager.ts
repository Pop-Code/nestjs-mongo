import { NotFoundException } from '@nestjs/common';
import { ClassTransformOptions } from 'class-transformer';
import { ClassType } from 'class-transformer/ClassTransformer';
import { isEmpty, validate } from 'class-validator';
import Debug from 'debug';
import { ChangeStream, CommonOptions, Cursor, FindOneOptions, MongoClient, MongoCountPreferences, ObjectId } from 'mongodb';

import { DEBUG } from './constants';
import { DataloaderService } from './dataloader/service';
import { InjectMongoClient } from './decorators';
import { getRepositoryToken } from './helpers';
import { EntityInterface } from './interfaces/entity';
import { ExceptionFactory } from './interfaces/exception';
import { MongoExecutionOptions } from './interfaces/execution.options';
import {
    CascadeType,
    getRelationshipMetadata,
    getRelationshipsCascadesMetadata,
    RelationshipMetadata,
} from './relationship/metadata';
import { MongoRepository } from './repository';
import { fromPlain, merge } from './transformers/utils';

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
        } else if (typeof nameOrInstance === 'string') {
            name = nameOrInstance;
        }

        if (name === undefined) {
            throw new Error(
                // eslint-disable-next-line @typescript-eslint/no-base-to-string
                `@Collection decorator is required to use a class as model for: ${nameOrInstance.toString()}`
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
        const dataloaderName =
            typeof options.dataloader === 'string'
                ? options.dataloader
                : entityName;
        try {
            this.log('saving %s', entityName);
            const errors = await validate(entity, {
                whitelist: true,
                validationError: { target: true, value: true }
            });
            if (errors.length > 0) {
                throw this.exceptionFactory(errors);
            }

            const collection = this.getCollection(entity, options.database);
            let operation: any;
            if (!isEmpty(entity._id)) {
                entity.updatedAt = new Date();

                const $unset: any = {};
                for (const p in entity) {
                    if (
                        Object.prototype.hasOwnProperty.call(entity, p) === true
                    ) {
                        const v: any = entity[p];
                        if (v === undefined) {
                            $unset[p] = 1;
                            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                            delete entity[p];
                        }
                    }
                }

                const sets: any = { $set: entity };

                if (Object.keys($unset).length > 0) {
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
            if (result.ok !== 1) {
                throw new Error('Unknow Error saving an entity');
            }

            // new id
            if (insertedId instanceof ObjectId) {
                entity._id = insertedId;
            }

            this.dataloaderService.update(dataloaderName, entity);

            return entity;
        } catch (e) {
            this.log('error saving %s', entityName);

            if (entity._id instanceof ObjectId) {
                this.dataloaderService.delete(dataloaderName, entity);
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
        const dataloaderName =
            typeof options.dataloader === 'string'
                ? options.dataloader
                : classType.name;
        this.dataloaderService.updateAll(dataloaderName, cursorMap);
        return cursorMap;
    }

    async findOne<Model extends EntityInterface>(
        classType: ClassType<Model>,
        query: any,
        options: FindOneOptions & { dataloader?: string } = {}
    ): Promise<Model> {
        this.log('findOne %s %o', classType.name, query);
        let entity: Model;
        const dataloaderName =
            typeof options.dataloader === 'string'
                ? options.dataloader
                : classType.name;
        const dataloader = this.getDataloader<Model>(dataloaderName);

        if (dataloader !== undefined && this.isIdQuery(query)) {
            this.log('findOne delegated to dataloader %s', dataloader.uuid);
            entity = await dataloader.load(query._id);
        }

        if (entity === undefined) {
            const obj = await this.getCollection(classType).findOne<object>(
                query,
                options
            );
            if (obj === undefined || obj === null) {
                return;
            }
            entity = this.fromPlain<Model>(classType, obj);
        }

        if (dataloader !== undefined) {
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

    protected async deleteCascade<Model extends EntityInterface>(
        classType: ClassType<Model>,
        entity: Model
    ) {
        const relationshipsCascades = getRelationshipsCascadesMetadata(
            classType
        );

        if (!Array.isArray(relationshipsCascades)) {
            return;
        }
        for (const relationshipCascades of relationshipsCascades) {
            if (!relationshipCascades.cascade.includes(CascadeType.DELETE)) {
                continue;
            }
            if (!relationshipCascades.isArray) {
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
        classType: ClassType<Model>,
        query: any,
        options: CommonOptions & { dataloader?: string } = {}
    ) {
        this.log('deleteOne %s %o', classType.name, query);
        const entity = await this.findOne<Model>(classType, query);

        if (entity === undefined) {
            throw new NotFoundException();
        }

        const result = await this.getCollection(classType).deleteOne(
            { _id: entity._id },
            options
        );
        const dataloaderName =
            typeof options.dataloader === 'string'
                ? options.dataloader
                : classType.name;
        this.dataloaderService.delete(dataloaderName, entity);

        await this.deleteCascade(classType, entity);

        return result;
    }

    async deleteMany<Model extends EntityInterface>(
        classType: ClassType<Model>,
        query: any,
        options: CommonOptions & { dataloader?: string } = {}
    ) {
        this.log('deleteMany %s %o', classType.name, query);
        const items = await this.find(classType, query, options);

        // get a ref of entities that are going to be deleted before to delete them
        const entities = await items.toArray();

        const result = await this.getCollection(classType).deleteMany(
            query,
            options
        );
        const dataloaderName =
            typeof options.dataloader === 'string'
                ? options.dataloader
                : classType.name;
        const dataloader = this.getDataloader<Model>(dataloaderName);

        for (const entity of entities) {
            await this.deleteCascade(classType, entity);
            if (dataloader !== undefined && result.deletedCount > 0) {
                dataloader.clear(entity._id);
            }
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

    async getRelationship<R extends EntityInterface = any, P = object>(
        object: P,
        property: string,
        options: {
            cachedMetadata?: RelationshipMetadata<R>;
            dataloader?: string;
        } = {}
    ): Promise<R> {
        this.log('getRelationship %s on %s', property, object.constructor.name);

        let relationMetadata = options.cachedMetadata;
        if (isEmpty(relationMetadata)) {
            relationMetadata = getRelationshipMetadata<R, P>(
                object,
                property,
                this
            );
            if (isEmpty(relationMetadata)) {
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

        return relationship;
    }

    async getRelationships<R extends EntityInterface = any, P = object>(
        object: P,
        property: string,
        options: {
            cachedMetadata?: RelationshipMetadata<R>;
            dataloader?: string;
        } = {}
    ): Promise<Array<R | Error>> {
        this.log(
            'getRelationships %s on %s',
            property,
            object.constructor.name
        );

        let relationMetadata = options.cachedMetadata;
        if (isEmpty(relationMetadata)) {
            relationMetadata = getRelationshipMetadata<R, P>(
                object,
                property,
                this
            );
            if (isEmpty(relationMetadata)) {
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

        return relationships;
    }

    async getInversedRelationships<
        P extends EntityInterface = any,
        C extends EntityInterface = any
    >(parent: P, ChildType: ClassType<C>, property: string) {
        let relationMetadata: RelationshipMetadata<P>;
        if (isEmpty(relationMetadata)) {
            relationMetadata = getRelationshipMetadata<P, C>(
                new ChildType(), // fix typing
                property,
                this
            );
            if (isEmpty(relationMetadata)) {
                throw new Error(
                    `The property ${property} metadata @Relationship must be set to call getInversedRelationships of ${parent.constructor.name}`
                );
            }
        }

        if (isEmpty(relationMetadata.inversedBy)) {
            throw new Error(`Can not get inversed metadata`);
        }

        const repository = this.getRepository(ChildType);

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
        return fromPlain(classType, data, options);
    }

    merge<Model extends EntityInterface>(
        entity: Model,
        data: any,
        options?: ClassTransformOptions
    ): Model {
        this.log('%s transform merge', entity.constructor.name);
        return merge(entity, data, options);
    }
}

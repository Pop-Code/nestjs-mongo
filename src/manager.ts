import { NotFoundException } from '@nestjs/common';
import { ClassConstructor, ClassTransformOptions } from 'class-transformer';
import { isEmpty, validate, ValidatorOptions } from 'class-validator';
import Debug from 'debug';
import { omit } from 'lodash';
import {
    ChangeStream,
    ChangeStreamOptions,
    ClientSession,
    CommonOptions,
    Cursor,
    FindOneOptions,
    MongoClient,
    MongoCountPreferences,
    ObjectId,
} from 'mongodb';

import { DEBUG } from './constants';
import { DataloaderService } from './dataloader/service';
import { InjectMongoClient } from './decorators';
import { getObjectName, getRepositoryToken } from './helpers';
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
    protected readonly models: Map<string, ClassConstructor<any>> = new Map();

    protected log = Debug(DEBUG + ':MongoManager');
    constructor(
        @InjectMongoClient()
        protected readonly client: MongoClient,
        protected readonly dataloaderService: DataloaderService,
        protected readonly exceptionFactory: ExceptionFactory
    ) {}

    registerModel<Model extends EntityInterface>(
        name: string,
        model: ClassConstructor<Model>
    ): MongoManager {
        this.log('Add model %s as %s', model.name, name);
        this.models.set(name, model);
        return this;
    }

    getModel(id: string): ClassConstructor<any> | undefined {
        return this.models.get(id);
    }

    getModels(): Map<string, ClassConstructor<any>> {
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
    >(classType: ClassConstructor<Model>): R {
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

    getMongoSession() {
        return this.dataloaderService.getMongoSession();
    }

    setMongoSession(mongoSession: ClientSession): void {
        this.dataloaderService.setMongoSession(mongoSession);
    }

    clearMongoSession(): void {
        this.dataloaderService.clearMongoSession();
    }

    getCollectionName<Model extends EntityInterface>(
        nameOrInstance: Model | ClassConstructor<Model>
    ): string {
        let name: string | undefined;
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

        if (name === undefined) {
            throw new Error(
                '@Collection decorator is required to use a class as model'
            );
        }

        return name;
    }

    getCollection<Model extends EntityInterface>(
        nameOrInstance: Model | ClassConstructor<Model>,
        databaseName?: string
    ) {
        return this.getDatabase(databaseName).collection(
            this.getCollectionName(nameOrInstance)
        );
    }

    async validate(
        obj: any,
        validatorOptions: ValidatorOptions = {},
        throwError: boolean = false
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

    async save<Model extends EntityInterface>(
        entity: Model,
        options: MongoExecutionOptions & {
            dataloader?: string;
            skipValidation?: boolean;
            validatorOptions?: ValidatorOptions;
        } = {}
    ): Promise<Model> {
        const entityName = entity.constructor.name;
        const dataloaderName =
            typeof options.dataloader === 'string'
                ? options.dataloader
                : entityName;

        const session = this.getMongoSession();

        try {
            this.log('saving %s', entityName);
            if (options.skipValidation !== true) {
                await this.validate(entity, options.validatorOptions, true);
            }
            const collection = this.getCollection(entity, options.database);

            const Model = this.getModel(entityName);
            if (Model === undefined) {
                throw new Error(`Can not find model ${entityName}`);
            }
            const proxy = this.merge(new Model(), entity);

            let operation: any;
            if (!isEmpty(proxy._id)) {
                proxy.updatedAt = new Date();

                const $unset: any = {};
                for (const p in entity) {
                    if (
                        Object.prototype.hasOwnProperty.call(proxy, p) === true
                    ) {
                        const v: any = proxy[p];
                        if (v === undefined) {
                            $unset[p] = 1;
                            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                            delete proxy[p];
                        }
                    }
                }

                const sets: any = { $set: proxy };
                if (Object.keys($unset).length > 0) {
                    sets.$unset = $unset;
                }
                operation = collection.updateOne({ _id: proxy._id }, sets, {
                    upsert: false,
                    ...(session !== undefined ? { session } : {})
                });
            } else {
                operation = collection.insertOne(proxy, {
                    ...(session !== undefined ? { session } : {})
                });
            }
            const { result, insertedId } = await operation;
            if (result.ok !== 1) {
                throw new Error('Unknow Error saving an entity');
            }

            // new id
            if (insertedId instanceof ObjectId) {
                proxy._id = insertedId;
            }

            // merge the proxy changes back to the entity
            this.merge(entity, proxy);
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
        classType: ClassConstructor<Model>,
        query: any,
        options: { dataloader?: string; session?: ClientSession } = {}
    ): Promise<Cursor<Model>> {
        this.log('find %s %o', classType.name, query);
        const session = this.getMongoSession();

        const cursor: Cursor<object> = this.getCollection(classType).find(
            query,
            {
                ...(session !== undefined ? { session } : {}),
                ...omit(options, 'dataloader')
            }
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
        classType: ClassConstructor<Model>,
        query: any,
        options: FindOneOptions<Model> & { dataloader?: string } = {}
    ): Promise<Model | undefined> {
        this.log('findOne %s %o', classType.name, query);
        const session = this.getMongoSession();

        let entity: Model | undefined;
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
                {
                    ...(session !== undefined ? { session } : {}),
                    ...omit(options, 'dataloader')
                }
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
        classType: ClassConstructor<Model>,
        query: any,
        options: MongoCountPreferences = {}
    ): Promise<number> {
        this.log('count %s %o', classType.name, query);
        const session = this.getMongoSession();
        return await this.getCollection(classType).countDocuments(query, {
            ...(session !== undefined ? { session } : {}),
            ...options
        });
    }

    isIdQuery(query: any): boolean {
        return Object.keys(query).length === 1 && query._id;
    }

    isIdsQuery(query: any): boolean {
        return this.isIdQuery(query) && Array.isArray(query._id.$in);
    }

    protected async deleteCascade<Model extends EntityInterface>(
        classType: ClassConstructor<Model>,
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
            if (
                relationshipCascades.isArray !== undefined &&
                !relationshipCascades.isArray
            ) {
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
        query: any,
        options: CommonOptions & { dataloader?: string } = {}
    ) {
        this.log('deleteOne %s %o', classType.name, query);
        const session = this.getMongoSession();
        const entity = await this.findOne<Model>(classType, query);

        if (entity === undefined) {
            throw new NotFoundException();
        }

        const result = await this.getCollection(classType).deleteOne(
            { _id: entity._id },
            {
                ...(session !== undefined ? { session } : {}),
                ...omit(options, 'dataloader')
            }
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
        classType: ClassConstructor<Model>,
        query: any,
        options: CommonOptions & { dataloader?: string } = {}
    ) {
        this.log('deleteMany %s %o', classType.name, query);
        const session = this.getMongoSession();
        const items = await this.find(classType, query, options);

        // get a ref of entities that are going to be deleted before to delete them
        const entities = await items.toArray();

        const result = await this.getCollection(classType).deleteMany(query, {
            ...(session !== undefined ? { session } : {}),
            ...omit(options, 'dataloader')
        });
        const dataloaderName =
            typeof options.dataloader === 'string'
                ? options.dataloader
                : classType.name;
        const dataloader = this.getDataloader<Model>(dataloaderName);

        for (const entity of entities) {
            await this.deleteCascade(classType, entity);
            if (
                dataloader !== undefined &&
                result.deletedCount !== undefined &&
                result.deletedCount > 0
            ) {
                dataloader.clear(entity._id);
            }
        }

        return result;
    }

    watch<Model extends EntityInterface>(
        classType: ClassConstructor<Model>,
        pipes?: any[],
        options: ChangeStreamOptions & { session?: ClientSession } = {}
    ): ChangeStream {
        this.log('watch %o', pipes);
        const session = this.getMongoSession();
        return this.getCollection(classType).watch(pipes, {
            ...(session !== undefined ? { session } : {}),
            ...options
        });
    }

    async getRelationship<R extends EntityInterface = any, P = Object>(
        obj: P,
        property: string,
        options: {
            dataloader?: string;
            session?: ClientSession;
        } = {}
    ): Promise<R | undefined> {
        this.log('getRelationship %s on %s', property, obj);
        const relationMetadata = getRelationshipMetadata<R>(
            obj,
            property,
            this
        );
        if (isEmpty(relationMetadata)) {
            throw new Error(
                `The property ${property} metadata @Relationship must be set to call getRelationship on ${getObjectName(
                    obj
                )}`
            );
        }

        if (
            relationMetadata.isArray !== undefined &&
            relationMetadata.isArray
        ) {
            throw new Error(
                `The property ${property} is defined as an array, please use getRelationships instead of getRelationship`
            );
        }

        const value = obj[property];
        const relationship = await this.findOne(
            relationMetadata.type,
            { _id: value },
            options
        );

        return relationship;
    }

    async getRelationships<R extends EntityInterface = any, P = Object>(
        obj: P,
        property: string,
        options: {
            dataloader?: string;
            session?: ClientSession;
        } = {}
    ): Promise<Array<R | Error>> {
        this.log('getRelationships %s on %s', property, obj);

        const relationMetadata = getRelationshipMetadata<R>(
            obj,
            property,
            this
        );
        if (isEmpty(relationMetadata) || relationMetadata === undefined) {
            throw new Error(
                `The property ${property} metadata @Relationship must be set to call getRelationships on ${getObjectName(
                    obj
                )}`
            );
        }

        if (
            relationMetadata?.isArray !== undefined &&
            !relationMetadata?.isArray
        ) {
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

    async getInversedRelationships<
        P extends EntityInterface = any,
        C extends EntityInterface = any
    >(
        parent: P,
        ChildType: ClassConstructor<C>,
        property: string,
        options: { session?: ClientSession } = {}
    ) {
        let relationMetadata: RelationshipMetadata<P> | undefined;
        if (isEmpty(relationMetadata)) {
            relationMetadata = getRelationshipMetadata<P>(
                new ChildType(), // fix typing
                property,
                this
            );
            if (isEmpty(relationMetadata)) {
                throw new Error(
                    `The property ${property} metadata @Relationship must be set to call getInversedRelationships of ${getObjectName(
                        parent
                    )}`
                );
            }
        }

        if (isEmpty(relationMetadata?.inversedBy)) {
            throw new Error('Can not get inversed metadata');
        }

        // todo set metadata for inversed side insted of using implicit _id ? ?
        const children = await this.find(
            ChildType,
            {
                [property]: parent._id
            },
            options
        );

        return await children.toArray();
    }

    fromPlain<Model extends EntityInterface>(
        classType: ClassConstructor<Model>,
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
        this.log('%s transform merge', getObjectName(entity));
        return merge(data, entity, options);
    }
}

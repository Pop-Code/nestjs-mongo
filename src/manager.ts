import { Injectable } from '@nestjs/common';
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
import { InjectMongoClient } from './decorators';
import { getRepositoryToken } from './helpers';
import { EntityInterfaceStatic, EntityInterface } from './interfaces/entity';
import { ExceptionFactory } from './interfaces/exception';
import { MongoExecutionOptions } from './interfaces/execution.options';
import { MongoRepository } from './repository';

@Injectable()
export class MongoManager {
    protected readonly repositories: Map<string, any> = new Map();
    protected log = Debug(DEBUG + ':' + MongoManager.name);
    constructor(
        @InjectMongoClient()
        protected readonly client: MongoClient,
        protected readonly exceptionFactory: ExceptionFactory
    ) {}

    addRepository<T extends MongoRepository<any>>(
        token: string,
        repository: T
    ): MongoManager {
        this.repositories.set(token, repository);
        return this;
    }

    getRepository<T extends MongoRepository<any>>(entity: Function): T {
        return this.repositories.get(getRepositoryToken(entity.name));
    }

    getClient(): MongoClient {
        return this.client;
    }

    getDatabase(databaseName?: string) {
        return this.client.db(databaseName);
    }

    getCollectionName(nameOrFunction: any): string {
        let name: string = nameOrFunction;
        if (
            typeof nameOrFunction === 'object' ||
            typeof nameOrFunction === 'function'
        ) {
            name = Reflect.getMetadata(
                'mongo:collectionName',
                typeof nameOrFunction === 'object'
                    ? nameOrFunction.constructor
                    : nameOrFunction
            );
            if (!name) {
                throw new Error(
                    '@Collection decorator is required to use a class as model for:' +
                        nameOrFunction
                );
            }
        }
        return name;
    }

    getCollection(nameOrFunction: any, databaseName?: string) {
        return this.getDatabase(databaseName).collection(
            this.getCollectionName(nameOrFunction)
        );
    }

    async save<Model extends EntityInterface>(
        entity: Model,
        options?: MongoExecutionOptions
    ): Promise<Model> {
        this.log('save %s %s', entity.constructor.name);
        const errors = await validate(entity, {
            whitelist: true,
            validationError: { target: true, value: true }
        });
        if (errors.length) {
            throw this.exceptionFactory(errors);
        }

        const opts = {
            collection: this.getCollectionName(entity),
            ...options
        };
        const collection = this.getCollection(opts.collection, opts.database);

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
                ...opts.mongoOperationOptions
            });
        } else {
            operation = collection.insertOne(
                entity,
                opts.mongoOperationOptions
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

        return entity;
    }

    async find<Model extends EntityInterface>(
        classType: EntityInterfaceStatic,
        query: any
    ): Promise<Cursor<Model>> {
        this.log('find %s %o', classType.name, query);
        const cursor: Cursor<Object> = await this.getCollection(classType).find(
            query
        );
        return cursor.map(entity => classType.fromPlain<Model>(entity));
    }

    async findOne<Model extends EntityInterface>(
        classType: EntityInterfaceStatic,
        query: any,
        options?: FindOneOptions
    ): Promise<Model> {
        this.log('findOne %s %o', classType.name, query);
        const entity = await this.getCollection(classType).findOne<Object>(
            query,
            options
        );
        return entity ? classType.fromPlain<Model>(entity) : null;
    }

    async count(
        classType: EntityInterfaceStatic,
        query: any,
        options?: MongoCountPreferences
    ): Promise<number> {
        this.log('count %s %o', classType, query);
        return await this.getCollection(classType).countDocuments(
            query,
            options
        );
    }

    async deleteOne(
        classType: EntityInterfaceStatic,
        query: any,
        options?: CommonOptions
    ) {
        this.log('deleteOne %s %o', classType, query);
        return await this.getCollection(classType).deleteOne(query, options);
    }

    watch(
        classType: EntityInterfaceStatic,
        pipes?: any[],
        options?: any
    ): ChangeStream {
        this.log('watch %o', pipes);
        return this.getCollection(classType).watch(pipes, options);
    }

    async getRelationship<Model extends EntityInterface>(
        object: any,
        property: string
    ): Promise<Model> {
        this.log('getRelationship %s on %s', property, object.constructor.name);

        const relationMetadata: {
            type: EntityInterfaceStatic;
        } = Reflect.getMetadata('mongo:relationship', object, property);

        if (!relationMetadata) {
            throw new Error(
                `The ${property} metadata (@Relationship(type)) must be set to call getRelationship`
            );
        }

        const repository = this.getRepository(relationMetadata.type);
        const relationship = await repository.findOne({
            _id: object[property]
        });

        if (
            relationship &&
            typeof object.setCachedRelationship === 'function'
        ) {
            object.setCachedRelationship(property, relationship);
        }

        return relationship;
    }
}

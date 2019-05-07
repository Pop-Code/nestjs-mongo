import { Injectable } from '@nestjs/common';
import { ObjectId } from 'bson';
import {
    classToPlain,
    ClassTransformOptions,
    plainToClass
} from 'class-transformer';
import { ClassType } from 'class-transformer/ClassTransformer';
import { validate } from 'class-validator';
import Debug from 'debug';
import _ from 'lodash';
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
import { Entity } from './entity';
import { getRepositoryToken } from './helpers';
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

    getEntityCollection(entity: Function): string {
        return entity.constructor.name.toLowerCase();
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

    protected toClass<K, T>(
        classType: any,
        data: T,
        options?: ClassTransformOptions
    ): K {
        //Data are comming from db and already are plain object, but objectIds are not working with class-transformer
        //The model definition will re transform the objectIds
        const plain = JSON.parse(JSON.stringify(data));
        const classO = plainToClass<K, T>(classType, plain, options);
        this.log('Transform data to class from plain %O => %O', plain, classO);
        return classO;
    }

    protected toPlain(entity: any, options?: ClassTransformOptions): any {
        const plain = classToPlain(entity, options);
        this.log('Transform data to plain from class %O => %O', entity, plain);
        return plain;
    }

    async save<T extends Entity>(
        entity: T,
        options?: MongoExecutionOptions
    ): Promise<T> {
        this.log('save %s %s', entity.constructor.name);
        const errors = await validate(entity, {
            whitelist: true,
            forbidNonWhitelisted: true,
            validationError: { target: true, value: true }
        });
        if (errors.length) {
            throw this.exceptionFactory(errors);
        }
        const proxyClass = _.cloneDeep(entity);

        // force class to avoid id and keep _id
        delete (proxyClass as any).id;

        const opts = {
            collection: this.getCollectionName(entity),
            ...options
        };
        const collection = this.getCollection(opts.collection, opts.database);

        let operation: any;
        if (entity._id) {
            proxyClass.updatedAt = new Date();

            const pureObject = _.assign({}, proxyClass);
            const sets: any = { $set: pureObject };

            const $unset: any = {};
            for (const p in proxyClass) {
                if (proxyClass.hasOwnProperty(p)) {
                    const v: any = proxyClass[p];
                    if (v === undefined) {
                        $unset[p] = 1;
                        delete proxyClass[p];
                    }
                }
            }

            if (Object.keys($unset).length) {
                sets.$unset = $unset;
            }

            operation = collection.updateOne(
                { _id: (proxyClass as any)._id },
                sets,
                { upsert: false, ...opts.mongoOperationOptions }
            );
        } else {
            const pureObject = _.assign({}, proxyClass);
            operation = collection.insertOne(
                pureObject,
                opts.mongoOperationOptions
            );
        }
        const { result, insertedId } = await operation;
        if (!result.ok) {
            throw new Error('Unknow Error during entity save');
        }

        // updated at
        if (proxyClass.updatedAt) {
            entity.updatedAt = proxyClass.updatedAt;
        }

        // new id
        if (insertedId) {
            (entity as any)._id = insertedId;
        }

        return entity;
    }

    async find<K>(classType: ClassType<K>, query: any): Promise<Cursor<K>> {
        this.log('find %s %o', classType.name, query);
        const cursor: Cursor<Object> = await this.getCollection(classType).find(
            query
        );
        return cursor.map(entity => this.toClass<K, Object>(classType, entity));
    }

    async findOne<T>(
        classType: any,
        query: any,
        options?: FindOneOptions
    ): Promise<T> {
        this.log('findOne %s %o', classType.name, query);
        /*if (typeof query._id === 'string') {
            query._id = new ObjectId(query._id);
        }*/
        const entity = await this.getCollection(classType).findOne<Object>(
            query,
            options
        );
        return entity ? this.toClass<T, Object>(classType, entity) : null;
    }

    async count(
        classType: any,
        query: any,
        options?: MongoCountPreferences
    ): Promise<number> {
        this.log('count %s %o', classType.name, query);
        return await this.getCollection(classType).countDocuments(
            query,
            options
        );
    }

    async deleteOne(
        classType: any,
        query: any,
        options?: CommonOptions
    ): Promise<any> {
        this.log('deleteOne %s %o', classType.name, query);
        return await this.getCollection(classType).deleteOne(query, options);
    }

    watch<T>(
        classType: ClassType<T>,
        pipes?: any[],
        options?: any
    ): ChangeStream {
        this.log('watch %o', pipes);
        return this.getCollection(classType).watch(pipes, options);
    }

    async getRelationship<T>(object: any, property: string): Promise<T> {
        this.log('getRelationship %s on %s', property, object.constructor.name);
        const relationMetadata = Reflect.getMetadata(
            'mongo:relationship',
            object,
            property
        );
        if (!relationMetadata) {
            throw new Error(
                `The ${property} metadata (@Relationship(type)) must be set to call getRelationship`
            );
        }

        // get the repository for this entity ?
        const repository = this.getRepository(relationMetadata.type);
        const data = await repository.findOne({
            _id: object[property]
        });
        const entity: any = data
            ? this.toClass<T, any>(relationMetadata.type, data)
            : null;
        if (
            entity &&
            typeof object.setCachedRelationship === 'function' &&
            entity
        ) {
            object.setCachedRelationship(property, entity);
        }

        return entity;
    }
}

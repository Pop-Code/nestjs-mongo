/**
 * @module nestjs-mongo
 */

import { Injectable } from '@nestjs/common';
import { ObjectId } from 'bson';
import {
    classToClass,
    classToPlain,
    ClassTransformOptions,
    plainToClass
} from 'class-transformer';
import { ClassType } from 'class-transformer/ClassTransformer';
import { validate } from 'class-validator';
import _ from 'lodash';
import {
    ChangeStream,
    CommonOptions,
    Cursor,
    FindOneOptions,
    MongoClient,
    MongoCountPreferences
} from 'mongodb';
import { InjectMongoClient } from './decorators';
import { Entity } from './entity';
import { getRepositoryToken } from './helpers';
import { ExceptionFactory } from './interfaces/exception';
import { MongoExecutionOptions } from './interfaces/execution.options';
import { MongoRepository } from './repository';

@Injectable()
export class MongoManager {
    repositories: Map<string, any> = new Map();

    constructor(
        @InjectMongoClient()
        protected readonly client: MongoClient,
        protected readonly exceptionFactory: ExceptionFactory
    ) {}

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
                console.log(name, nameOrFunction);
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

    toClass<K, T>(classType: any, data: K, options?: ClassTransformOptions): T {
        return plainToClass(classType, data, options);
    }

    toPlain(entity: any, options?: ClassTransformOptions): any {
        return classToPlain(entity, options);
    }

    async save<T extends Entity>(
        entity: T,
        options?: MongoExecutionOptions
    ): Promise<T> {
        const errors = await validate(entity, {
            validationError: { target: true, value: true }
        });
        if (errors.length) {
            throw this.exceptionFactory(errors);
        }
        const proxyClass = classToClass<T>(entity);

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

    async find<T>(classType: ClassType<T>, query: any): Promise<Cursor<T>> {
        const cursor: Cursor<T> = await this.getCollection(classType).find(
            query
        );
        return cursor.map(d => this.toClass<any, T>(classType, d));
    }

    async findOne<T>(
        classType: any,
        query: any,
        options?: FindOneOptions
    ): Promise<T> {
        if (typeof query._id === 'string') {
            query._id = new ObjectId(query._id);
        }
        const entity = await this.getCollection(classType).findOne(
            query,
            options
        );
        return entity ? this.toClass<any, T>(classType, entity) : null;
    }

    async count(
        classType: any,
        query: any,
        options?: MongoCountPreferences
    ): Promise<number> {
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
        return await this.getCollection(classType).deleteOne(query, options);
    }

    watch<T>(
        classType: ClassType<T>,
        pipes?: any[],
        options?: any
    ): ChangeStream {
        return this.getCollection(classType).watch(pipes, options);
    }

    async getRelationship<T>(object: any, property: string): Promise<T> {
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
        const data = await this.getCollection(relationMetadata.type).findOne<T>(
            {
                _id: object[property]
            }
        );
        const entity: any = data
            ? this.toClass<any, T>(relationMetadata.type, data)
            : null;

        if (object.setCachedRelationship && entity) {
            object.setCachedRelationship(property, entity);
        }

        return entity;
    }
}

import { ModuleMetadata, Type } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { MongoClientOptions } from 'mongodb';

import { EntityInterface } from '../entity/interfaces';
import { EntityRepository } from '../entity/repository';

/**
 * The options of a connection: a `uri`, every `MongoClientOptions` of the mongodb driver, and an `exceptionFactory`.
 */
export interface MongoModuleOptions extends MongoClientOptions {
    /**
     * The mongodb connection string, for example `mongodb://localhost:27017/my-db`.
     */
    uri: string;
    /**
     * Build the error thrown when an entity is not valid on save. Defaults to throwing the `ValidationError[]` array.
     */
    exceptionFactory?: ExceptionFactory;
}

/**
 * The options of {@link MongoModule.forRootAsync}.
 */
export interface MongoModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
    /**
     * The name of the connection. Required only when you use more than one connection.
     */
    connectionName?: string;
    /**
     * Return the {@link MongoModuleOptions}, can be async.
     */
    useFactory: (...args: any[]) => Promise<MongoModuleOptions> | MongoModuleOptions;
    /**
     * Providers to inject into `useFactory`.
     */
    inject?: any[];
}

/**
 * Register a model with a custom repository class.
 */
export interface MongoFeatureModelOptions<Model extends EntityInterface, Repository extends EntityRepository<Model>> {
    model: Type<Model>;
    repository?: Type<Repository>;
}

/**
 * The options of {@link MongoModule.forFeature}.
 */
export interface MongoFeatureOptions {
    connectionName?: string;
    models: Array<MongoFeatureModelOptions<any, any> | Type<EntityInterface>>;
}

/**
 * Build the error thrown when the validation of an entity fails.
 */
export type ExceptionFactory = (errors: ValidationError[]) => any;

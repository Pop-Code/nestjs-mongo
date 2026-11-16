import { ModuleMetadata, Type } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { MongoClientOptions } from 'mongodb';

import { EntityInterface } from '../entity/interfaces';
import { EntityManagerOptions } from '../entity/manager';
import { EntityRepository } from '../entity/repository';
import { Migration } from '../migration/migration';

/**
 * The options of a connection: a `uri`, every `MongoClientOptions` of the mongodb driver, and the options of the module.
 */
export interface MongoModuleOptions extends MongoClientOptions, Omit<EntityManagerOptions, 'connectionName'> {
    /**
     * The mongodb connection string, for example `mongodb://localhost:27017/my-db`.
     */
    uri: string;
    /**
     * Build the error thrown when an entity is not valid on save. Defaults to an `EntityValidationException`
     * (a `BadRequestException` with the `ValidationError[]` in its `errors` property).
     */
    exceptionFactory?: ExceptionFactory;
    /**
     * The migrations of the connection (see `MigrationRunner`).
     */
    migrations?: Migration[];
    /**
     * Run the pending `migrations` when the module starts (default `false`).
     */
    migrationsRun?: boolean;
}

/**
 * A class that creates the {@link MongoModuleOptions}, for the `useClass` / `useExisting` options of
 * {@link MongoModule.forRootAsync}.
 */
export interface MongoOptionsFactory {
    createMongoOptions: () => Promise<MongoModuleOptions> | MongoModuleOptions;
}

/**
 * The options of {@link MongoModule.forRoot}.
 */
export interface MongoModuleSyncOptions extends MongoModuleOptions {
    /**
     * The name of the connection. Required only when you use more than one connection.
     */
    connectionName?: string;
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
    useFactory?: (...args: any[]) => Promise<MongoModuleOptions> | MongoModuleOptions;
    /**
     * Providers to inject into `useFactory`.
     */
    inject?: any[];
    /**
     * A {@link MongoOptionsFactory} class, instantiated by the module.
     */
    useClass?: Type<MongoOptionsFactory>;
    /**
     * An existing {@link MongoOptionsFactory} provider (from `imports`).
     */
    useExisting?: Type<MongoOptionsFactory>;
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

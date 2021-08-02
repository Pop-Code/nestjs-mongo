import { Type } from '@nestjs/common';
import { ModuleMetadata } from '@nestjs/common/interfaces';
import { ValidationError } from 'class-validator';
import { MongoClientOptions } from 'mongodb';

import { EntityInterface } from '../entity/interfaces';
import { EntityRepository } from '../entity/repository';

export interface MongoOptionsFactory {
    createMongoOptions: () => Promise<MongoModuleOptions> | MongoModuleOptions;
}

export interface MongoModuleOptions extends MongoClientOptions {
    uri: string;
    exceptionFactory?: ExceptionFactory;
}

export interface MongoModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
    connectionName?: string;
    useFactory: (...args: any[]) => Promise<MongoModuleOptions> | MongoModuleOptions;
    inject?: any[];
}

export interface MongoFeatureModelOptions {
    model: Type<EntityInterface>;
    repository?: Type<EntityRepository<EntityInterface>>;
}

export interface MongoFeatureOptions {
    connectionName?: string;
    models: Array<MongoFeatureModelOptions | Type<EntityInterface>>;
}

export type ExceptionFactory = (errors: ValidationError[]) => any;

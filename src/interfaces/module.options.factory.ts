/**
 * @module nestjs-mongo
 */

import { MongoModuleOptions } from './module.options';

export interface MongoOptionsFactory {
    createMongoOptions(): Promise<MongoModuleOptions> | MongoModuleOptions;
}

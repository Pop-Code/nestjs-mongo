/**
 * @module nestjs-mongo
 */

import { ModuleMetadata } from '@nestjs/common/interfaces';
import { MongoModuleOptions } from './module.options';

export interface MongoModuleAsyncOptions
    extends Pick<ModuleMetadata, 'imports'> {
    connectionName?: string;
    useFactory: (
        ...args: any[]
    ) => Promise<MongoModuleOptions> | MongoModuleOptions;
    inject?: any[];
}

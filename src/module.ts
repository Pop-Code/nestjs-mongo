/**
 * @module nestjs-mongo
 */

import { Module, DynamicModule } from '@nestjs/common';
import { MongoModuleAsyncOptions } from './interfaces/async.options';
import { MongoFeatureOptions } from './interfaces/feature.options';
import { MongoCoreModule } from './module.core';

@Module({})
export class MongoModule {
    static forRootAsync(options: MongoModuleAsyncOptions): DynamicModule {
        return {
            module: MongoModule,
            imports: [MongoCoreModule.forRootAsync(options)]
        };
    }

    static forFeature(options: MongoFeatureOptions): DynamicModule {
        const providers = MongoCoreModule.createProviders(
            options.models,
            options.connectionName
        );
        return {
            module: MongoModule,
            providers,
            exports: providers
        };
    }
}

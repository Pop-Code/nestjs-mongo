import { DynamicModule, Module } from '@nestjs/common';

import { MongoCoreModule } from './core';
import { MongoFeatureOptions, MongoModuleAsyncOptions } from './interfaces';

@Module({})
export class MongoModule {
    static forRootAsync(options: MongoModuleAsyncOptions): DynamicModule {
        return {
            module: MongoModule,
            imports: [MongoCoreModule.forRootAsync(options)]
        };
    }

    static forFeature(options: MongoFeatureOptions): DynamicModule {
        const providers = MongoCoreModule.createProviders(options.models, options.connectionName);
        return {
            module: MongoModule,
            providers,
            exports: providers
        };
    }
}

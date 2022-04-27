import { DynamicModule, Global, Module, OnModuleDestroy } from '@nestjs/common';
import { getFromContainer, isEmpty } from 'class-validator';
import { MongoClient } from 'mongodb';

import { DEFAULT_CONNECTION_NAME, NAMED_CONNECTION_TOKEN } from '../constants';
import { EntityManager } from '../entity/manager';
import { IsValidRelationshipConstraint } from '../relationship/constraint';
import { SessionLoaderService } from '../session/service';
import { IsUniqueConstraint } from '../validation/unique/constraint';
import { MongoFeatureModule } from './feature';
import { getConfigToken, getConnectionToken, getEntityManagerToken, InjectEntityManager } from './injection';
import { MongoFeatureOptions, MongoModuleAsyncOptions, MongoModuleOptions } from './interfaces';

@Global()
@Module({})
export class MongoModule implements OnModuleDestroy {
    constructor(@InjectEntityManager() private readonly em: EntityManager) {}

    async onModuleDestroy() {
        await this.em.getClient().close();
    }

    static async forRootAsync(options: MongoModuleAsyncOptions): Promise<DynamicModule> {
        // define the connection token name
        const connectionName = !isEmpty(options.connectionName) ? options.connectionName : DEFAULT_CONNECTION_NAME;

        const mongoConnectionToken = getConnectionToken(connectionName);

        // The client name provider to be expose on this dynammic module level
        const mongoConnectionNameProvider = {
            provide: NAMED_CONNECTION_TOKEN,
            useValue: mongoConnectionToken
        };

        // the config provider
        const configToken = getConfigToken(connectionName);
        const configProvider = {
            provide: configToken,
            ...options
        };

        // the mongo client provider
        const mongoClientProvider = {
            provide: mongoConnectionToken,
            useFactory: async (config: MongoModuleOptions): Promise<MongoClient> => {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { uri, exceptionFactory, ...mongoOpts } = config;
                const client = new MongoClient(uri, mongoOpts);
                return await client.connect();
            },
            inject: [configToken]
        };

        const sessionLoaderServiceProvider = {
            provide: SessionLoaderService,
            useClass: SessionLoaderService
        };

        // the mongo manager provider
        const managerToken = getEntityManagerToken(connectionName);
        const mongoManagerProvider = {
            provide: managerToken,
            useFactory: (
                client: MongoClient,
                config: MongoModuleOptions,
                sessionLoaderService: SessionLoaderService
            ): EntityManager => {
                if (typeof config.exceptionFactory !== 'function') {
                    config.exceptionFactory = (errors) => errors;
                }
                const em = new EntityManager(client, sessionLoaderService, config.exceptionFactory);

                const isValidRelationship = getFromContainer(IsValidRelationshipConstraint);
                isValidRelationship.setEm(em);

                const isUnique = getFromContainer(IsUniqueConstraint);
                isUnique.setEm(em);

                return em;
            },
            inject: [mongoConnectionToken, configToken, SessionLoaderService]
        };

        return {
            module: MongoModule,
            imports: options.imports,
            providers: [
                mongoConnectionNameProvider,
                configProvider,
                mongoClientProvider,
                sessionLoaderServiceProvider,
                mongoManagerProvider
            ],
            exports: [
                mongoConnectionNameProvider,
                configProvider,
                mongoClientProvider,
                sessionLoaderServiceProvider,
                mongoManagerProvider
            ]
        };
    }

    static forFeature(options: MongoFeatureOptions): DynamicModule {
        return MongoFeatureModule.forFeature(options);
    }
}

import { DynamicModule, Global, Inject, Module, OnModuleDestroy, Provider } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { getFromContainer, isEmpty } from 'class-validator';
import { omit } from 'lodash';
import { MongoClient } from 'mongodb';

import { DEFAULT_CONNECTION_NAME, NAMED_CONNECTION_TOKEN } from '../constants';
import { EntityValidationException } from '../errors';
import { EntityManager, registerEntityManager } from '../entity/manager';
import { MigrationRunner } from '../migration/migration';
import { IsValidRelationshipConstraint } from '../relationship/constraint';
import { SessionLoaderService } from '../session/service';
import { IsUniqueConstraint } from '../validation/unique/constraint';
import { MongoFeatureModule } from './feature';
import { getConfigToken, getConnectionToken, getEntityManagerToken } from './injection';
import {
    MongoFeatureOptions,
    MongoModuleAsyncOptions,
    MongoModuleOptions,
    MongoModuleSyncOptions,
    MongoOptionsFactory
} from './interfaces';

const MANAGER_NAME_TOKEN = 'nestjs-mongo:manager:name';

/**
 * The root module. Register a connection with {@link MongoModule.forRoot} / {@link MongoModule.forRootAsync}
 * and models with {@link MongoModule.forFeature}.
 */
@Global()
@Module({})
export class MongoModule implements OnModuleDestroy {
    constructor(
        @Inject(MANAGER_NAME_TOKEN) private readonly managerToken: string,
        private readonly moduleRef: ModuleRef
    ) {}

    /**
     * Close the change streams and the mongo client of this connection when the application shuts down.
     */
    async onModuleDestroy() {
        await this.moduleRef.get<EntityManager>(this.managerToken, { strict: true }).close();
    }

    /**
     * Register a mongo connection with static options.
     *
     * Call it once per connection, in the root module of the application.
     * Give a `connectionName` to register more than one connection.
     */
    static forRoot(options: MongoModuleSyncOptions): DynamicModule {
        const { connectionName, ...config } = options;
        return MongoModule.forRootAsync({ connectionName, useFactory: () => config });
    }

    /**
     * Register a mongo connection, with options from a factory (`useFactory`), or from a {@link MongoOptionsFactory}
     * class (`useClass` / `useExisting`).
     *
     * Call it once per connection, in the root module of the application.
     * Give a `connectionName` to register more than one connection.
     */
    static forRootAsync(options: MongoModuleAsyncOptions): DynamicModule {
        const connectionName = !isEmpty(options.connectionName)
            ? (options.connectionName as string)
            : DEFAULT_CONNECTION_NAME;
        const mongoConnectionToken = getConnectionToken(connectionName);
        const configToken = getConfigToken(connectionName);
        const managerToken = getEntityManagerToken(connectionName);

        const managerNameProvider: Provider = { provide: MANAGER_NAME_TOKEN, useValue: managerToken };
        const providers: Provider[] = [
            { provide: NAMED_CONNECTION_TOKEN, useValue: mongoConnectionToken },
            ...MongoModule.createConfigProviders(configToken, options),
            {
                provide: mongoConnectionToken,
                useFactory: async (config: MongoModuleOptions): Promise<MongoClient> => {
                    const mongoOpts = omit(config, [
                        'uri',
                        'exceptionFactory',
                        'autoIndex',
                        'syncIndexes',
                        'schemaValidation',
                        'migrations',
                        'migrationsRun'
                    ]);
                    const client = new MongoClient(config.uri, mongoOpts);
                    return await client.connect();
                },
                inject: [configToken]
            },
            { provide: SessionLoaderService, useClass: SessionLoaderService },
            {
                provide: managerToken,
                useFactory: async (
                    client: MongoClient,
                    config: MongoModuleOptions,
                    sessionLoaderService: SessionLoaderService
                ): Promise<EntityManager> => {
                    const em = new EntityManager(
                        client,
                        sessionLoaderService,
                        typeof config.exceptionFactory === 'function'
                            ? config.exceptionFactory
                            : (errors) => new EntityValidationException(errors),
                        {
                            connectionName,
                            autoIndex: config.autoIndex,
                            syncIndexes: config.syncIndexes,
                            schemaValidation: config.schemaValidation
                        }
                    );

                    registerEntityManager(em);
                    getFromContainer(IsValidRelationshipConstraint).setEm(em);
                    getFromContainer(IsUniqueConstraint).setEm(em);

                    if (config.migrationsRun === true && config.migrations !== undefined) {
                        await new MigrationRunner(em).up(config.migrations);
                    }

                    return em;
                },
                inject: [mongoConnectionToken, configToken, SessionLoaderService]
            }
        ];

        return {
            module: MongoModule,
            imports: options.imports,
            providers: [managerNameProvider, ...providers],
            exports: providers
        };
    }

    private static createConfigProviders(configToken: string, options: MongoModuleAsyncOptions): Provider[] {
        if (options.useFactory !== undefined) {
            return [{ provide: configToken, useFactory: options.useFactory, inject: options.inject ?? [] }];
        }
        const factoryClass = options.useClass ?? options.useExisting;
        if (factoryClass === undefined) {
            throw new Error('MongoModule.forRootAsync() requires useFactory, useClass or useExisting');
        }
        return [
            ...(options.useClass !== undefined ? [{ provide: options.useClass, useClass: options.useClass }] : []),
            {
                provide: configToken,
                useFactory: async (factory: MongoOptionsFactory) => await factory.createMongoOptions(),
                inject: [factoryClass]
            }
        ];
    }

    /**
     * Register models (and their repositories) on a connection.
     */
    static forFeature(options: MongoFeatureOptions): DynamicModule {
        return MongoFeatureModule.forFeature(options);
    }
}

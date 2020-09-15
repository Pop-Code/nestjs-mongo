import { DynamicModule, Global, Inject, Module, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { getFromContainer, isEmpty } from 'class-validator';
import { MongoClient } from 'mongodb';

import { DEFAULT_CONNECTION_NAME, NAMED_CONNECTION_TOKEN } from './constants';
import { DataloaderService } from './dataloader/service';
import { getConfigToken, getConnectionToken, getManagerToken, getRepositoryToken } from './helpers';
import { MongoModuleAsyncOptions } from './interfaces/async.options';
import { MongoModuleOptions } from './interfaces/module.options';
import { MongoManager } from './manager';
import { IsValidRelationshipConstraint } from './relationship/constraint';
import { setRelationshipsCascadesMetadata } from './relationship/metadata';
import { MongoRepository } from './repository';
import { IsUniqueConstraint } from './validation/unique/constraint';

@Global()
@Module({})
export class MongoCoreModule implements OnModuleDestroy, OnModuleInit {
    constructor(
        private readonly moduleRef: ModuleRef,
        @Optional()
        @Inject(NAMED_CONNECTION_TOKEN)
        public readonly namedConnectionToken: string
    ) {}

    async onModuleDestroy() {
        const connection = this.moduleRef.get<MongoClient>(
            this.namedConnectionToken
        );
        await connection.close(true);
    }

    async onModuleInit() {
        const managerToken = getManagerToken(DEFAULT_CONNECTION_NAME);
        const manager = this.moduleRef.get<MongoManager>(managerToken);
        const models = manager.getModels();
        for (const [, Model] of models.entries()) {
            setRelationshipsCascadesMetadata(Model, manager);
        }
    }

    static async forRootAsync(
        options: MongoModuleAsyncOptions
    ): Promise<DynamicModule> {
        // define the connection token name
        const connectionName = !isEmpty(options.connectionName)
            ? options.connectionName
            : DEFAULT_CONNECTION_NAME;

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
            useFactory: async (
                config: MongoModuleOptions
            ): Promise<MongoClient> => {
                const { uri, exceptionFactory, ...mongoOpts } = config;
                const client = new MongoClient(uri, {
                    useNewUrlParser: true,
                    useUnifiedTopology: true,
                    ...mongoOpts
                });
                return await client.connect();
            },
            inject: [configToken]
        };

        const dataloaderServiceProvider = {
            provide: DataloaderService,
            useClass: DataloaderService
        };

        // the mongo manager provider
        const managerToken = getManagerToken(connectionName);
        const mongoManagerProvider = {
            provide: managerToken,
            useFactory: (
                client: MongoClient,
                config: MongoModuleOptions,
                dataloaderService: DataloaderService
            ): MongoManager => {
                const em = new MongoManager(
                    client,
                    dataloaderService,
                    config.exceptionFactory
                );

                const c = getFromContainer(IsValidRelationshipConstraint);
                c.setEm(em);
                const c2 = getFromContainer(IsUniqueConstraint);
                c2.setEm(em);

                return em;
            },
            inject: [mongoConnectionToken, configToken, DataloaderService]
        };

        return {
            module: MongoCoreModule,
            imports: options.imports,
            providers: [
                mongoConnectionNameProvider,
                configProvider,
                mongoClientProvider,
                dataloaderServiceProvider,
                mongoManagerProvider
            ],
            exports: [
                mongoConnectionNameProvider,
                configProvider,
                mongoClientProvider,
                dataloaderServiceProvider,
                mongoManagerProvider
            ]
        };
    }

    public static createProviders(
        models: any[] = [],
        connectionName: string = DEFAULT_CONNECTION_NAME
    ) {
        const providers: any = [];
        const managerToken = getManagerToken(connectionName);
        for (const m of models) {
            const model = typeof m === 'function' ? m : m.model;
            const repoToken = getRepositoryToken(model.name, connectionName);
            const RepoClass =
                typeof m === 'function' ? MongoRepository : m.repository;
            providers.push({
                provide: repoToken,
                inject: [managerToken],
                useFactory: async (em: MongoManager) => {
                    // register model on manager
                    em.registerModel(model.name, model);

                    // register repository
                    const repo = new RepoClass(em, model);
                    em.registerRepository(repoToken, repo);
                    return repo;
                }
            });
        }

        return providers;
    }
}

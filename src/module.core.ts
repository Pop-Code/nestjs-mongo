import {
    DynamicModule,
    Global,
    Inject,
    Module,
    OnModuleDestroy,
    Optional
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { getFromContainer } from 'class-validator';
import { MongoClient } from 'mongodb';
import { DEFAULT_CONNECTION_NAME, NAMED_CONNECTION_TOKEN } from './constants';
import { MongoDataloader } from './dataloader/data';
import { DataloaderService } from './dataloader/service';
import {
    getConfigToken,
    getConnectionToken,
    getDataloaderToken,
    getManagerToken,
    getRepositoryToken
} from './helpers';
import { MongoModuleAsyncOptions } from './interfaces/async.options';
import { MongoModuleOptions } from './interfaces/module.options';
import { MongoManager } from './manager';
import { IsValidRelationshipConstraint } from './relationship/constraint';
import { MongoRepository } from './repository';
import { IsUniqueConstraint } from './validation/unique/constraint';

@Global()
@Module({})
export class MongoCoreModule implements OnModuleDestroy {
    constructor(
        private readonly moduleRef: ModuleRef,
        @Optional()
        @Inject(NAMED_CONNECTION_TOKEN)
        public readonly namedConnectionToken: string
    ) {}

    static async forRootAsync(
        options: MongoModuleAsyncOptions
    ): Promise<DynamicModule> {
        // define the connection token name
        const connectionName = options.connectionName
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
            useFactory: (config: MongoModuleOptions): Promise<MongoClient> => {
                const { uri, exceptionFactory, ...mongoOpts } = config;
                const client = new MongoClient(uri, {
                    useNewUrlParser: true,
                    useUnifiedTopology: true,
                    ...mongoOpts
                });
                return client.connect();
            },
            inject: [configToken]
        };

        // the mongo client provider
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

    async onModuleDestroy() {
        const connection = this.moduleRef.get<MongoClient>(
            this.namedConnectionToken
        );
        await connection.close(true);
    }

    public static createProviders(
        models: any[] = [],
        connectionName: string = DEFAULT_CONNECTION_NAME
    ) {
        const providers: any = [];

        for (const m of models) {
            const managerToken = getManagerToken(connectionName);
            const model = typeof m === 'function' ? m : m.model;
            providers.push({
                provide: model,
                useClass: model
            });
            const loaderToken = getDataloaderToken(model.name, connectionName);
            providers.push({
                provide: loaderToken,
                inject: [managerToken],
                useFactory: (em: MongoManager) => {
                    const dataloaderService = em.getDataloaderService();
                    const loader = dataloaderService.createAndRegister(
                        model.name,
                        model,
                        em
                    );
                    return loader;
                }
            });

            const repoToken = getRepositoryToken(model.name, connectionName);
            const repoClass =
                typeof m === 'function' ? MongoRepository : m.repository;
            providers.push({
                provide: repoToken,
                inject: [managerToken, loaderToken],
                useFactory: (
                    em: MongoManager,
                    loader: MongoDataloader<typeof model>
                ) => {
                    const repo = new repoClass(em, model, loader);
                    em.addRepository(repoToken, repo);
                    return repo;
                }
            });
        }

        return providers;
    }
}

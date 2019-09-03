import {
    Module,
    DynamicModule,
    OnModuleDestroy,
    Inject,
    Global,
    Optional,
    Scope
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { MongoClient, ObjectId } from 'mongodb';
import { MongoRepository } from './repository';
import { MongoManager } from './manager';
import { NAMED_CONNECTION_TOKEN, DEFAULT_CONNECTION_NAME } from './constants';
import { MongoModuleOptions } from './interfaces/module.options';
import { MongoModuleAsyncOptions } from './interfaces/async.options';
import {
    getRepositoryToken,
    getConnectionToken,
    getManagerToken,
    getConfigToken,
    getDataloaderToken
} from './helpers';
import { getFromContainer } from 'class-validator';
import { IsValidRelationshipConstraint } from './relationship/constraint';
import { IsUniqueConstraint } from './validation/unique/constraint';
import Dataloader from 'dataloader';
import { EntityInterface } from './interfaces/entity';
import { DataloaderService } from './dataloader/service';

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
                    ...mongoOpts
                });
                return client.connect();
            },
            inject: [configToken]
        };

        // the mongo client provider
        const dataServiceProvider = {
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
                dataServiceProvider,
                mongoManagerProvider
            ],
            exports: [
                mongoConnectionNameProvider,
                configProvider,
                mongoClientProvider,
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
            if (typeof m === 'function') {
                providers.push({
                    provide: m,
                    useClass: m
                });
            } else {
                providers.push({
                    provide: m.model,
                    useClass: m.model
                });
            }

            const loaderToken = getDataloaderToken(model.name, connectionName);
            providers.push({
                scope: Scope.REQUEST,
                provide: loaderToken,
                inject: [getManagerToken(connectionName)],
                useFactory: (em: MongoManager) => {
                    const dataloader = em.createDataLoader(model);
                    //em.addDataloader(loaderToken, dataloader);
                    return dataloader;
                }
            });

            const repoToken = getRepositoryToken(model.name, connectionName);
            const RepoClass =
                typeof m === 'function' ? MongoRepository : m.repository;
            providers.push({
                provide: repoToken,
                inject: [managerToken],
                useFactory: (em: MongoManager) => {
                    const repo = new RepoClass(em, model);
                    em.addRepository(repoToken, repo);
                    return repo;
                }
            });
        }

        return providers;
    }
}

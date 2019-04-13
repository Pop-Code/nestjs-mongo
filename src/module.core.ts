import {
    Module,
    DynamicModule,
    OnModuleDestroy,
    Inject,
    Global,
    Optional
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { MongoClient } from 'mongodb';
import { MongoRepository } from './repository';
import { MongoManager } from './manager';
import { NAMED_CONNECTION_TOKEN, DEFAULT_CONNECTION_NAME } from './constants';
import { MongoModuleOptions } from './interfaces/module.options';
import { MongoModuleAsyncOptions } from './interfaces/async.options';
import {
    getRepositoryToken,
    getConnectionToken,
    getManagerToken,
    getConfigToken
} from './helpers';
import { getFromContainer } from 'class-validator';
import { IsValidRelationshipConstraint } from './validation/relationship/constraint';

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

        // the mongo manager provider
        const managerToken = getManagerToken(connectionName);
        const mongoManagerProvider = {
            provide: managerToken,
            useFactory: (
                client: MongoClient,
                config: MongoModuleOptions
            ): MongoManager => {
                const em = new MongoManager(client, config.exceptionFactory);
                const c = getFromContainer(IsValidRelationshipConstraint);
                c.setEm(em);
                return em;
            },
            inject: [mongoConnectionToken, configToken]
        };

        return {
            module: MongoCoreModule,
            imports: options.imports,
            providers: [
                mongoConnectionNameProvider,
                configProvider,
                mongoClientProvider,
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
        // expose models to be injectable
        const ms = models.map(m => {
            // without custom repo
            if (typeof m === 'function') {
                return {
                    provide: m,
                    useClass: m
                };
            }
            // console.log(m);
            // console.trace();
            return {
                provide: m.model,
                useClass: m.model
            };
        });

        // expose repository
        const mr = models.map(m => {
            const model = typeof m === 'function' ? m : m.model;
            const RepoClass =
                typeof m === 'function' ? MongoRepository : m.repository;
            const token = getRepositoryToken(model.name, connectionName);
            return {
                provide: token,
                inject: [getManagerToken(connectionName)],
                useFactory: (em: MongoManager): MongoRepository<any> => {
                    const repo = new RepoClass(em, model);
                    em.addRepository(token, repo);
                    return repo;
                }
            };
        });

        return [...ms, ...mr];
    }
}

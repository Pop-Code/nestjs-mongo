import { ModuleMetadata, Type } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ClassConstructor } from 'class-transformer';
import type { MongoMemoryReplSet } from 'mongodb-memory-server-core';

import { EntityInterface } from '../entity/interfaces';
import { EntityManager } from '../entity/manager';
import { SaveOptions } from '../entity/options';
import { MongoModule } from '../module/core';
import { getEntityManagerToken } from '../module/injection';
import { MongoModuleOptions } from '../module/interfaces';

/** A MongoDB server started by {@link startMongoMemoryServer}. */
export interface MongoMemoryServer {
    /** The connection string of the server, with the database name when one was given. */
    uri: string;
    /** Stops the server and removes its data. */
    stop: () => Promise<void>;
}

/** Options of {@link startMongoMemoryServer}. */
export interface MongoMemoryServerOptions {
    /** The version of the MongoDB server (the default version of mongodb-memory-server when not set). */
    version?: string;
    /** The database name added to the connection string. */
    dbName?: string;
}

type MemoryServerModule = { MongoMemoryReplSet: typeof MongoMemoryReplSet };

function loadMemoryServer(): MemoryServerModule {
    for (const name of ['mongodb-memory-server', 'mongodb-memory-server-core']) {
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            return require(name);
        } catch (e) {
            if (e?.code !== 'MODULE_NOT_FOUND') throw e;
        }
    }
    throw new Error('Install mongodb-memory-server (or mongodb-memory-server-core) to use startMongoMemoryServer()');
}

/**
 * Starts an in-memory MongoDB replica set (transactions and change streams work), with mongodb-memory-server.
 * The MongoDB binary is downloaded on the first start.
 *
 * ```ts
 * const server = await startMongoMemoryServer({ dbName: 'test' });
 * // MongoModule.forRoot({ uri: server.uri }) ...
 * await server.stop();
 * ```
 */
export async function startMongoMemoryServer(options: MongoMemoryServerOptions = {}): Promise<MongoMemoryServer> {
    const { MongoMemoryReplSet } = loadMemoryServer();
    const replSet = await MongoMemoryReplSet.create({
        replSet: { count: 1, storageEngine: 'wiredTiger' },
        ...(options.version !== undefined ? { binary: { version: options.version } } : {})
    });
    return {
        uri: replSet.getUri(options.dbName),
        stop: async () => {
            await replSet.stop();
        }
    };
}

/** Options of {@link createMongoTestingModule}. */
export interface MongoTestingModuleOptions extends Pick<ModuleMetadata, 'imports' | 'providers' | 'controllers'> {
    /** The connection string. */
    uri: string;
    /** The models registered with `MongoModule.forFeature()`. */
    models: Array<Type<EntityInterface>>;
    /** The other options of the connection. */
    options?: Omit<MongoModuleOptions, 'uri'>;
}

/**
 * Creates and initializes a NestJS testing module with a connection and models.
 * Close it with `module.close()` at the end of the tests.
 */
export async function createMongoTestingModule({
    uri,
    models,
    options = {},
    imports = [],
    providers = [],
    controllers = []
}: MongoTestingModuleOptions): Promise<{ module: TestingModule; em: EntityManager }> {
    const module = await Test.createTestingModule({
        imports: [MongoModule.forRoot({ uri, ...options }), MongoModule.forFeature({ models }), ...imports],
        providers,
        controllers
    }).compile();
    await module.init();
    return { module, em: module.get<EntityManager>(getEntityManagerToken()) };
}

/**
 * Inserts fixtures: each plain object is loaded as an entity of the model, validated and inserted.
 */
export async function loadFixtures<Model extends EntityInterface>(
    em: EntityManager,
    model: ClassConstructor<Model>,
    data: Array<Partial<Model>>,
    options: SaveOptions = {}
) {
    return await em.insertMany(
        data.map((item) => em.fromPlain(model, item)),
        options
    );
}

/**
 * Removes the documents of the collections of the registered models (the collections and their indexes are kept).
 */
export async function clearDatabase(em: EntityManager): Promise<void> {
    await Promise.all([...em.getModels().values()].map(async (model) => await em.getCollection(model).deleteMany({})));
}

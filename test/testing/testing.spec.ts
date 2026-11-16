import 'reflect-metadata';

import { TestingModule } from '@nestjs/testing';

import { EntityManager, EntityValidationException } from '../../src';
import {
    clearDatabase,
    createMongoTestingModule,
    loadFixtures,
    MongoMemoryServer,
    startMongoMemoryServer
} from '../../src/testing';
import { EntityTest } from '../entity/entity';

let server: MongoMemoryServer;
let testingModule: TestingModule;
let em: EntityManager;

beforeAll(async () => {
    // the MongoDB binary is downloaded on the first start
    server = await startMongoMemoryServer({ dbName: 'testing' });
    ({ module: testingModule, em } = await createMongoTestingModule({ uri: server.uri, models: [EntityTest] }));
}, 300000);

describe('testing helpers', () => {
    it('should start a replica set and create the testing module', async () => {
        expect(server.uri).toContain('replicaSet=');
        expect(em.getDatabase().databaseName).toBe('testing');
        // transactions require a replica set
        const count = await em.withTransaction(async () => {
            await em.save(Object.assign(new EntityTest(), { foo: 'tx', bar: 'tx' }));
            return await em.count(EntityTest);
        });
        expect(count).toBe(1);
    });

    it('should load the fixtures and clear the database', async () => {
        const entities = await loadFixtures(em, EntityTest, [
            { foo: 'a', bar: 'a' },
            { foo: 'b', bar: 'b' }
        ]);
        expect(entities[0]).toBeInstanceOf(EntityTest);
        await expect(loadFixtures(em, EntityTest, [{ foo: 1 as unknown as string }])).rejects.toBeInstanceOf(
            EntityValidationException
        );
        expect(await em.count(EntityTest)).toBe(3);
        await clearDatabase(em);
        expect(await em.count(EntityTest)).toBe(0);
        expect((await em.getCollection(EntityTest).listIndexes().toArray()).length).toBeGreaterThan(0);
    });
});

describe('startMongoMemoryServer without mongodb-memory-server', () => {
    it('should ask to install mongodb-memory-server', async () => {
        const notFound = () => {
            throw Object.assign(new Error('not found'), { code: 'MODULE_NOT_FOUND' });
        };
        await jest.isolateModulesAsync(async () => {
            jest.doMock('mongodb-memory-server', notFound, { virtual: true });
            jest.doMock('mongodb-memory-server-core', notFound);
            const testing = await import('../../src/testing');
            await expect(testing.startMongoMemoryServer()).rejects.toThrow('Install mongodb-memory-server');
        });
    });

    it('should throw the other loading errors', async () => {
        await jest.isolateModulesAsync(async () => {
            jest.doMock(
                'mongodb-memory-server',
                () => {
                    throw new Error('broken install');
                },
                { virtual: true }
            );
            const testing = await import('../../src/testing');
            await expect(testing.startMongoMemoryServer({ version: '8.0.0' })).rejects.toThrow('broken install');
        });
    });
});

afterAll(async () => {
    await testingModule?.close();
    await server?.stop();
});

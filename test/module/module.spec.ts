import 'reflect-metadata';

import { BadRequestException, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoClient } from 'mongodb';

import {
    DEFAULT_CONNECTION_NAME,
    EntityManager,
    EntityRepository,
    getConnectionToken,
    getEntityManagerToken,
    MongoModule,
    runInSessionContext
} from '../../src';
import { DBTEST } from '../constants';
import { EntityTest } from '../entity/entity';
import { EntityChildTest } from './child';
import { MongoDbModuleTest } from './module';

let mod: TestingModule;
let app: INestApplication;
const uri = DBTEST + '-module';

beforeAll(async () => {
    mod = await Test.createTestingModule({
        imports: [
            MongoModule.forRootAsync({
                useFactory: () => ({
                    uri,
                    exceptionFactory: (errors) => {
                        return new BadRequestException(errors);
                    }
                })
            }),
            MongoDbModuleTest
        ]
    }).compile();
    app = mod.createNestApplication();
    await app.init();
});

describe('forRootAsync', () => {
    it('should get the mongo client', () => {
        const namedConnectionToken = getConnectionToken(DEFAULT_CONNECTION_NAME);
        const client = mod.get<MongoClient>(namedConnectionToken);
        expect(client).toBeDefined();
        expect(client).toBeInstanceOf(MongoClient);
    });
});

describe('forFeature', () => {
    it('should get the entity manager', () => {
        const manager = mod.get<EntityManager>(getEntityManagerToken());
        expect(manager).toBeDefined();
        expect(manager).toBeInstanceOf(EntityManager);
    });
    it('should get a repository', () => {
        const mongoModuleTest = mod.get<MongoDbModuleTest>(MongoDbModuleTest);
        expect(mongoModuleTest).toBeDefined();
        expect(mongoModuleTest.repo).toBeDefined();
        expect(mongoModuleTest.repo).toBeInstanceOf(EntityRepository);
    });
    it('should get the collection name from the Collection decorator', () => {
        const manager = mod.get<EntityManager>(getEntityManagerToken());
        const name = manager.getCollectionName<EntityTest>(EntityTest);
        expect(name).toEqual('entityTest');
    });
    it('should have 3 collections', async () => {
        const manager = mod.get<EntityManager>(getEntityManagerToken());
        const cursor = manager.getDatabase().listCollections();
        const collections = await cursor.toArray();
        expect(collections).toHaveLength(3);
    });
});

describe('Mongo sessions loader', () => {
    it('should set / clear the session of the current context', async () => {
        const manager = mod.get<EntityManager>(getEntityManagerToken());
        const sessionLoaderService = manager.getSessionLoaderService();
        const session = manager.getClient().startSession();

        await runInSessionContext(async () => {
            sessionLoaderService.setSessionContext(session);
            expect(sessionLoaderService.getSessionContext()?.session).toBe(session);

            sessionLoaderService.clearSessionContext();
            expect(sessionLoaderService.getSessionContext()).toBeUndefined();
        });
        await session.endSession();
    });

    it('should throw when setting a session outside of a session context', async () => {
        const manager = mod.get<EntityManager>(getEntityManagerToken());
        const session = manager.getClient().startSession();
        expect(() => manager.setSessionContext(session)).toThrow('No session context');
        await session.endSession();
    });

    it('should throw while attempting to read a relationship created during a session if session is cleared', async () => {
        const manager = mod.get<EntityManager>(getEntityManagerToken());
        const session = manager.getClient().startSession();

        await runInSessionContext(async () => {
            await expect(
                session.withTransaction(async () => {
                    manager.setSessionContext(session);
                    const entity = new EntityTest();
                    entity.foo = 'bar';
                    entity.bar = 'foo';
                    await manager.save(entity);

                    manager.clearSessionContext();

                    // the parent only exists in the transaction: the validation outside of it fails
                    const child = new EntityChildTest();
                    child.foo = 'child';
                    child.parentId = entity._id;

                    await manager.save(child);
                })
            ).rejects.toBeDefined();
        });
        await session.endSession();
    });
});

afterAll(async () => {
    try {
        const em = mod.get<EntityManager>(getEntityManagerToken());
        await em.getDatabase().dropDatabase();
        await mod.close();
    } catch (e) {
        console.log(e);
    }
});

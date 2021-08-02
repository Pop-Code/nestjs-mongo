import 'reflect-metadata';

import { BadRequestException, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createNamespace } from 'cls-hooked';
import { MongoClient } from 'mongodb';

import {
    DEFAULT_CONNECTION_NAME,
    EntityManager,
    EntityRepository,
    getConnectionToken,
    getEntityManagerToken,
    MONGO_SESSION_KEY,
    MongoCoreModule,
    MongoModule,
    SESSION_LOADER_NAMESPACE,
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
    it('should get the default connection', () => {
        const mongoModule = mod.get<MongoModule>(MongoModule);
        expect(mongoModule).toBeDefined();
        const core = mod.get<MongoCoreModule>(MongoCoreModule);
        const namedConnectionToken = getConnectionToken(DEFAULT_CONNECTION_NAME);
        expect(core.namedConnectionToken).toBe(namedConnectionToken);

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
});

describe('Mongo sessions loader', () => {
    it('should set / clear session object on namespace', (done) => {
        const manager = mod.get<EntityManager>(getEntityManagerToken());
        const sessionLoaderService = manager.getSessionLoaderService();

        const ns = createNamespace(SESSION_LOADER_NAMESPACE);

        ns.run(() => {
            const session = manager.getClient().startSession();

            sessionLoaderService.setSessionContext(session);
            expect(ns.get(MONGO_SESSION_KEY).session).toEqual(session);

            sessionLoaderService.clearSessionContext();
            expect(ns.get(MONGO_SESSION_KEY)?.session).not.toBeDefined();

            session
                .endSession()
                .then(() => done())
                .catch((e) => {
                    console.error(e);
                    done();
                });
        });
    });

    it('should throw while attempting to read a relationship created during a session if session is cleared', (done) => {
        const manager = mod.get<EntityManager>(getEntityManagerToken());
        const session = manager.getClient().startSession();

        const namespace = createNamespace(SESSION_LOADER_NAMESPACE);

        namespace.run(() => {
            session
                .withTransaction(async () => {
                    manager.setSessionContext(session);

                    const entity = new EntityTest();
                    entity.foo = 'bar';
                    entity.bar = 'foo';
                    await manager.save(entity);

                    manager.clearSessionContext();

                    const child = new EntityChildTest();
                    child.foo = 'child';
                    child.parentId = entity._id;

                    await manager.save(child);
                })
                .catch((e) => {
                    expect(e).toBeDefined();
                })
                .finally(() => {
                    session
                        .endSession()
                        .catch((e) => {
                            console.error(e);
                        })
                        .finally(() => done());
                });
        });
    });
    it('should resolve a relationship created during a session', (done) => {
        const manager = mod.get<EntityManager>(getEntityManagerToken());
        const namespace = createNamespace(SESSION_LOADER_NAMESPACE);
        namespace.run(() => {
            const session = manager.getClient().startSession();
            manager.setSessionContext(session);
            session
                .withTransaction(async () => {
                    const entity = new EntityTest();
                    entity.foo = 'bar';
                    entity.bar = 'foo';
                    await manager.save(entity, { session });

                    const child = new EntityChildTest();
                    child.foo = 'child';
                    child.parentId = entity._id;

                    await manager.save(child, { session });
                })
                .then(async (value) => {
                    expect(value).toBeTruthy();
                })
                .finally(() => {
                    session
                        .endSession()
                        .then(() => done())
                        .catch((e) => {
                            console.error(e);
                            done();
                        });
                });
        });
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

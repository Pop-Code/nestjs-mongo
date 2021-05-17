import 'reflect-metadata';

import { BadRequestException, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createNamespace } from 'cls-hooked';
import { MongoClient } from 'mongodb';
import request from 'supertest';

import { DEFAULT_CONNECTION_NAME, MONGO_SESSION_KEY, SESSION_LOADER_NAMESPACE } from '../../src/constants';
import { DataloaderService } from '../../src/dataloader/service';
import { getConnectionToken, getManagerToken, getRepositoryToken } from '../../src/helpers';
import { MongoManager } from '../../src/manager';
import { MongoModule } from '../../src/module';
import { MongoCoreModule } from '../../src/module.core';
import { MongoRepository } from '../../src/repository';
import { DBTEST } from '../constants';
import { EntityTest } from '../entity/entity';
import { EntityChildTest } from './child';
import { TestController } from './controller';
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
                    exceptionFactory: (errors) => new BadRequestException(errors)
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
        const manager = mod.get<MongoManager>(getManagerToken());
        expect(manager).toBeDefined();
        expect(manager).toBeInstanceOf(MongoManager);
    });
    it('should get a repository', () => {
        const mongoModuleTest = mod.get<MongoDbModuleTest>(MongoDbModuleTest);
        expect(mongoModuleTest).toBeDefined();
        expect(mongoModuleTest.repo).toBeDefined();
        expect(mongoModuleTest.repo).toBeInstanceOf(MongoRepository);
    });
    it('should get the collection name from the Collection decorator', () => {
        const manager = mod.get<MongoManager>(getManagerToken());
        const name = manager.getCollectionName<EntityTest>(EntityTest);
        expect(name).toEqual('entityTest');
    });
});

describe('Dataloader', () => {
    let uuid: string;
    it('should not have a dataloader outside a request', async () => {
        const em = mod.get<MongoManager>(getManagerToken());
        // get the dataloader and check that he is empty, outside a request
        // no loader is used and must bbe created manualy
        const dataloaderService = mod.get(DataloaderService);
        let loader = dataloaderService.get('EntityTest');
        expect(loader).not.toBeDefined();

        const loaderUuid = '12345';
        loader = dataloaderService.create(EntityTest, em, loaderUuid);
        expect(loader).toBeDefined();
        expect(loader.uuid).toEqual(loaderUuid);
    });

    it('should use the same dataloader inside a request', async () => {
        const repo = mod.get<MongoRepository<EntityTest>>(getRepositoryToken(EntityTest.name));

        const entity = new EntityTest();
        entity.foo = 'test';
        entity.bar = 'dataloader';
        await repo.save(entity);

        const ctrl = mod.get(TestController);
        ctrl.entityTestId = entity._id;

        await request(app.getHttpServer())
            .get('/test')
            .expect((res) => {
                expect(res.body).toBeDefined();
                expect(res.body.item).toBeDefined();
                expect(res.body.item._id).toStrictEqual(entity._id.toHexString());
                expect(res.body.uuid).toBeDefined();
                expect(res.body.reqUuid).toBeDefined();
                expect(res.body.reqUuid).toEqual(res.body.uuid);
                uuid = res.body.uuid;
            });

        await request(app.getHttpServer())
            .get('/test')
            .expect((res) => {
                expect(res.body).toBeDefined();
                expect(res.body.item).toBeDefined();
                expect(res.body.item._id).toStrictEqual(entity._id.toHexString());
                expect(res.body.uuid).toBeDefined();
                expect(res.body.reqUuid).toBeDefined();
                expect(res.body.reqUuid).toEqual(res.body.uuid);
                // should not match previous request
                expect(res.body.uuid).not.toEqual(uuid);
            });
    });
});

describe('Mongo sessions loader', () => {
    it('should set / clear session object on namespace', (done) => {
        const manager = mod.get<MongoManager>(getManagerToken());
        const sessionLoaderService = manager.getSessionLoaderService();

        const ns = createNamespace(SESSION_LOADER_NAMESPACE);

        ns.run(() => {
            const session = manager.getClient().startSession();

            sessionLoaderService.setSessionContext(session);
            expect(ns.get(MONGO_SESSION_KEY).session).toEqual(session);

            sessionLoaderService.clearSessionContext();
            expect(ns.get(MONGO_SESSION_KEY)?.session).not.toBeDefined();

            session.endSession();
            done();
        });
    });

    it('should throw while attempting to read a relationship created during a session if session is cleared', (done) => {
        const manager = mod.get<MongoManager>(getManagerToken());
        const session = manager.getClient().startSession();

        const namespace = createNamespace(SESSION_LOADER_NAMESPACE);

        namespace.run(() => {
            session
                .withTransaction(
                    async () => {
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
                    },
                    {
                        readPreference: 'primary',
                        readConcern: { level: 'local' },
                        writeConcern: { w: 'majority' }
                    }
                )
                .catch((e) => {
                    expect(e).toBeDefined();
                })
                .finally(() => {
                    session.endSession();
                    done();
                });
        });
    });
    it('should resolve a relationship created during a session', (done) => {
        const manager = mod.get<MongoManager>(getManagerToken());
        const session = manager.getClient().startSession();
        const namespace = createNamespace(SESSION_LOADER_NAMESPACE);
        namespace.run(() => {
            session
                .withTransaction(
                    async () => {
                        manager.setSessionContext(session);

                        const entity = new EntityTest();
                        entity.foo = 'bar';
                        entity.bar = 'foo';
                        await manager.save<EntityTest>(entity);

                        const child = new EntityChildTest();
                        child.foo = 'child';
                        child.parentId = entity._id;
                        await manager.save(child);
                    },
                    {
                        readPreference: 'primary',
                        readConcern: { level: 'local' },
                        writeConcern: { w: 'majority' }
                    }
                )
                .then(async (value) => {
                    expect(value).toBeTruthy();
                })
                .finally(() => {
                    session.endSession();
                    done();
                });
        });
    });
});

afterAll(async () => {
    try {
        const em = mod.get<MongoManager>(getManagerToken());
        await em.getDatabase().dropDatabase();
        await mod.close();
    } catch (e) {
        console.log(e);
    }
});

import { Test, TestingModule } from '@nestjs/testing';
import { MongoModule, DEFAULT_CONNECTION_NAME } from '..';
import { MongoClient } from 'mongodb';
import { MongoDbModuleTest } from './module';
import { MongoRepository } from '../repository';
import { MongoCoreModule } from '../module.core';
import { getConnectionToken, getManagerToken, ObjectId } from '../helpers';
import { MongoManager } from '../manager';
import { EntityTest, TEST_COLLECTION_NAME } from './module/entity';
import { BadRequestException } from '@nestjs/common';
import { EntityChildTest } from './module/child';

export const DBTEST = 'mongodb://192.168.1.46:27017/nestjs-mongo-test';
let mod: TestingModule;

beforeAll(async () => {
    mod = await Test.createTestingModule({
        imports: [
            MongoModule.forRootAsync({
                useFactory: () => ({
                    uri: DBTEST,
                    exceptionFactory: errors => new BadRequestException(errors)
                })
            }),
            MongoDbModuleTest
        ]
    }).compile();
});

describe('MongoModule', () => {
    describe('forRootAsync', () => {
        it('should get the default connection', () => {
            const mongoModule = mod.get<MongoModule>(MongoModule);
            expect(mongoModule).toBeDefined();
            const core = mod.get<MongoCoreModule>(MongoCoreModule);
            const namedConnectionToken = getConnectionToken(
                DEFAULT_CONNECTION_NAME
            );
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

        it('should get the collection name from the Collection decorator', () => {
            const manager = mod.get<MongoManager>(getManagerToken());
            const name = manager.getCollectionName(EntityTest);
            expect(name).toEqual(TEST_COLLECTION_NAME);
        });

        it('should save a new entity', async () => {
            const manager = mod.get<MongoManager>(getManagerToken());
            const entity = new EntityTest();
            entity.foo = 'bar';
            entity.bar = 'foo';
            const response = await manager.save<EntityTest>(entity);
            expect(response).toBeInstanceOf(EntityTest);
            expect(response._id).toBeInstanceOf(ObjectId);
            expect(response.foo).toEqual(entity.foo);
            expect(response.bar).toEqual(entity.bar);
        });

        it('should save and update an existing entity', async () => {
            const manager = mod.get<MongoManager>(getManagerToken());
            const entity = new EntityTest();
            entity.foo = 'bar';
            entity.bar = 'foo';

            const response = await manager.save<EntityTest>(entity);
            response.foo = 'UPDATED_VALUE';

            try {
                const updated = await manager.save<EntityTest>(entity);
                expect(updated).toBeInstanceOf(EntityTest);
                expect(updated._id).toBeInstanceOf(ObjectId);
                expect(updated.foo).toEqual(entity.foo);
                expect(updated.bar).toEqual(entity.bar);
                expect(updated._id).toEqual(response._id);
            } catch (e) {
                console.log(e.response.message);
            }
        });

        it('should get a repository', () => {
            const mongoModuleTest = mod.get<MongoDbModuleTest>(
                MongoDbModuleTest
            );
            expect(mongoModuleTest).toBeDefined();
            expect(mongoModuleTest.repo).toBeDefined();
            expect(mongoModuleTest.repo).toBeInstanceOf(MongoRepository);
        });

        it('should save an new entity and set a relation ship with a new child', async () => {
            const manager = mod.get<MongoManager>(getManagerToken());

            const entity = new EntityTest();
            entity.foo = 'bar';
            entity.bar = 'foo';
            await manager.save<EntityTest>(entity);

            const child = new EntityChildTest();
            child.foo = 'child';
            child.parentId = entity._id;
            const response = await manager.save<EntityChildTest>(child);
            expect(response).toBeInstanceOf(EntityChildTest);
            expect(response._id).toBeInstanceOf(ObjectId);
            expect(response.foo).toEqual(child.foo);
            expect(response.parentId).toBeInstanceOf(ObjectId);
            expect(response.parentId).toEqual(entity._id);
        });

        it('should serialize entity identifiers', async () => {
            const manager = mod.get<MongoManager>(getManagerToken());
            const entity = await manager.findOne<EntityTest>(EntityTest, {});
            expect(entity._id).toBeInstanceOf(ObjectId);

            const obj: any = entity.toJSON();
            expect(obj._id).toBeDefined();
            expect(typeof obj._id).toEqual('string');

            const reEntity = EntityTest.fromPlain(EntityTest, obj);
            expect(reEntity._id).toBeInstanceOf(ObjectId);
            expect(reEntity._id).toEqual(entity._id);

            const child = new EntityChildTest();
            child.parentId = entity._id;
            const objChild: any = child.toJSON();
            expect(objChild.parentId).toEqual(entity._id.toHexString());

            const reChild = EntityChildTest.fromPlain(
                EntityChildTest,
                objChild
            );
            expect(reChild.parentId).toBeInstanceOf(ObjectId);
            expect(reChild.parentId).toEqual(entity._id);
        });
    });
});

afterAll(async () => {
    try {
        const em = mod.get<MongoManager>(getManagerToken());
        await em.getCollection(EntityTest).drop();
        await em.getCollection(EntityChildTest).drop();
        await em.getClient().close();
        await mod.close();
    } catch (e) {
        console.log(e);
    }
});

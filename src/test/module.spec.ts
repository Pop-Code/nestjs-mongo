import { Test, TestingModule } from '@nestjs/testing';
import { MongoModule, DEFAULT_CONNECTION_NAME } from '..';
import { MongoClient, ObjectId } from 'mongodb';
import { MongoDbModuleTest } from './module';
import { MongoRepository } from '../repository';
import { MongoCoreModule } from '../module.core';
import { getConnectionToken, getManagerToken } from '../helpers';
import { MongoManager } from '../manager';
import { EntityTest, TEST_COLLECTION_NAME } from './module/entity';
import { BadRequestException } from '@nestjs/common';
import { EntityChildTest } from './module/child';

export const DBTEST = 'mongodb://localhost:27017/test';

describe('MongoModule', () => {
    describe('forRootAsync', () => {
        let mod: TestingModule;

        beforeAll(async () => {
            mod = await Test.createTestingModule({
                imports: [
                    MongoModule.forRootAsync({
                        useFactory: () => ({
                            uri: DBTEST,
                            exceptionFactory: errors =>
                                new BadRequestException(errors)
                        })
                    })
                ]
            }).compile();
        });

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

        afterAll(async () => {
            const client = mod.get<MongoClient>(
                getConnectionToken(DEFAULT_CONNECTION_NAME)
            );

            await client.close(true);
        });
    });

    describe('forFeature', () => {
        let mod: TestingModule;

        beforeAll(async () => {
            mod = await Test.createTestingModule({
                imports: [
                    MongoModule.forRootAsync({
                        useFactory: () => ({
                            uri: DBTEST,
                            exceptionFactory: errors =>
                                new BadRequestException(errors)
                        })
                    }),
                    MongoDbModuleTest
                ]
            }).compile();
        });

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
            expect(response.id).toEqual(response._id.toHexString());
            expect(response.foo).toEqual(entity.foo);
            expect(response.bar).toEqual(entity.bar);
            expect(response.id).toEqual(response._id.toHexString());
        });

        it('should save and update an existing entity', async () => {
            const manager = mod.get<MongoManager>(getManagerToken());
            const entity = new EntityTest();
            entity.foo = 'bar';
            entity.bar = 'foo';

            const response = await manager.save<EntityTest>(entity);
            entity.foo = 'UPDATED_VALUE';

            const updated = await manager.save<EntityTest>(entity);
            expect(updated).toBeInstanceOf(EntityTest);
            expect(updated.id).toEqual(response._id.toHexString());
            expect(updated.foo).toEqual(entity.foo);
            expect(updated.bar).toEqual(entity.bar);
            expect(updated.id).toEqual(response._id.toHexString());
        });

        it('should get a repository', () => {
            const mongoModuleTest = mod.get<MongoDbModuleTest>(
                MongoDbModuleTest
            );
            expect(mongoModuleTest).toBeDefined();
            expect(mongoModuleTest.repo).toBeDefined();
            expect(mongoModuleTest.repo).toBeInstanceOf(MongoRepository);
        });

        it('should save an new entity and set a relation ship with a new child ', async () => {
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
            expect(response.id).toEqual(child._id.toHexString());
            expect(response.foo).toEqual(child.foo);
            expect(response.parentId).toBeInstanceOf(ObjectId);
            expect(response.parentId.toHexString()).toEqual(entity.id);
        });

        afterAll(async () => {
            const em = mod.get<MongoManager>(getManagerToken());
            await em.getCollection(EntityTest).drop();
            await em.getClient().close(true);
        });
    });
});

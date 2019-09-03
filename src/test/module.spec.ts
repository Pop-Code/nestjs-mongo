import { Test, TestingModule } from '@nestjs/testing';
import { MongoModule, DEFAULT_CONNECTION_NAME } from '..';
import { MongoClient } from 'mongodb';
import { MongoDbModuleTest } from './module';
import { MongoRepository } from '../repository';
import { MongoCoreModule } from '../module.core';
import {
    getConnectionToken,
    getManagerToken,
    ObjectId,
    getRepositoryToken
} from '../helpers';
import { MongoManager } from '../manager';
import { EntityTest, TEST_COLLECTION_NAME } from './module/entity';
import { BadRequestException } from '@nestjs/common';
import { EntityChildTest } from './module/child';
import { EntityNestedTest } from './module/entity.nested';
import { EntityRelationship } from './module/entity.relationship';
import { DataloaderService } from '../dataloader/service';

export const DBTEST = 'mongodb://localhost:27017/nestjs-mongo-test';
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
            const name = manager.getCollectionName<EntityTest>(EntityTest);
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

        it('should get a relationship', async () => {
            const manager = mod.get<MongoManager>(getManagerToken());

            const entity = new EntityTest();
            entity.foo = 'bar';
            entity.bar = 'foo';
            await manager.save<EntityTest>(entity);

            const child = new EntityChildTest();
            child.foo = 'child';
            child.parentId = entity._id;
            await manager.save(child);

            const parent = await manager.getRelationship<EntityTest>(
                child,
                'parentId'
            );
            expect(parent).toBeInstanceOf(EntityTest);
            expect(parent._id).toBeInstanceOf(ObjectId);
            expect(parent._id).toEqual(entity._id);

            const parentCached = child.getCachedRelationship('parentId');
            expect(parentCached._id).toEqual(parent._id);

            // set the parent as a nestedEntity on the child
            const nested = new EntityNestedTest();
            nested.parentId = parent._id;
            child.nestedEntity = nested;

            const entity1 = new EntityRelationship();
            entity1.foo = 'entity1';
            await manager.save(entity1);

            const entity2 = new EntityRelationship();
            entity2.foo = 'entity2';
            await manager.save(entity2);

            child.entities = [entity1._id, entity2._id];
            await manager.save(child);

            const relationshipEntities = await manager.getRelationships(
                child,
                'entities'
            );
            expect(relationshipEntities).toHaveLength(2);
            expect(relationshipEntities[0]).toBeInstanceOf(EntityRelationship);
            expect(relationshipEntities[0]._id).toEqual(entity1._id);

            // find the item as it is in db and test that cache is not present
            const childOBj = await manager
                .getCollection(EntityChildTest)
                .findOne({ _id: child._id });

            expect(childOBj.nestedEntity).not.toHaveProperty(
                '__cachedRelationships'
            );
            expect(childOBj.entities).toHaveLength(2);
            expect(childOBj.entities[0]).toEqual(entity1._id);
            expect(childOBj.entities[1]).toEqual(entity2._id);
        });

        it('should serialize an entity', async () => {
            const manager = mod.get<MongoManager>(getManagerToken());

            const entity = await manager.findOne<EntityTest>(EntityTest, {});

            expect(entity._id).toBeInstanceOf(ObjectId);

            const obj: any = entity.toJSON();
            expect(obj._id).toBeDefined();
            expect(typeof obj._id).toEqual('string');

            const reEntity = manager.getRepository(EntityTest).fromPlain(obj);
            expect(reEntity._id).toBeInstanceOf(ObjectId);
            expect(reEntity._id).toEqual(entity._id);

            const child = new EntityChildTest();
            child.parentId = entity._id;
            const objChild: any = child.toJSON();
            expect(objChild.parentId).toEqual(entity._id.toHexString());

            const reChild = manager
                .getRepository(EntityChildTest)
                .fromPlain(objChild);
            expect(reChild.parentId).toBeInstanceOf(ObjectId);
            expect(reChild.parentId).toEqual(entity._id);
        });

        it('should use dataloader during the whole request', async () => {
            const dataloaderService = mod.get<DataloaderService>(
                DataloaderService
            );

            const repo = mod.get<MongoRepository<EntityTest>>(
                getRepositoryToken(EntityTest.name)
            );

            const dataloader = dataloaderService.get(EntityTest.name);
            expect(dataloader).toBeDefined();

            // entity will not be put in the dataloader cache cause no key was passed
            const entity = new EntityTest();
            entity.foo = 'test';
            entity.bar = 'dataloader';
            await repo.save(entity);

            // fetch a new entity, this should trigger the dataloader for the first time
            const entity1 = await repo.findOne({
                _id: entity._id
            });

            // entity 1 should come from cache and equals entity
            expect(entity).toEqual(entity1);

            // fetch a new entity, this should trigger the dataloader for the first time
            const entity2 = await repo.findOne({
                _id: entity._id
            });

            // entity 1 should come from cache and equals entity
            expect(entity).toEqual(entity2);

            //remove item from the cache
            dataloader.clear(entity._id);

            // call the database should get the real item
            const entity3 = await repo.findOne({
                _id: entity._id
            });
            expect(entity).toEqual(entity3);
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

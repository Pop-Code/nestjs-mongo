import { BadRequestException, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoClient, ObjectID } from 'mongodb';
import request from 'supertest';

import { DataloaderService } from '../dataloader/service';
import {
    getConnectionToken,
    getManagerToken,
    getRepositoryToken,
    ObjectId
} from '../helpers';
import { MongoManager } from '../manager';
import { MongoCoreModule } from '../module.core';
import { MongoRepository } from '../repository';
import { MongoDbModuleTest } from './module';
import { EntityChildTest } from './module/child';
import { TestController } from './module/controller';
import { EntityTest, TEST_COLLECTION_NAME } from './module/entity';
import { EntityNestedTest } from './module/entity.nested';
import { EntityRelationship } from './module/entity.relationship';
import { MongoModule } from '../module';
import { DEFAULT_CONNECTION_NAME } from '../constants';
import { getRelationshipMetadata } from '../relationship/metadata';
import { EntitySlugTest } from './module/entity.slug';

export const DBTEST = 'mongodb://localhost:27017/nestjs-mongo-test';
let mod: TestingModule;
let app: INestApplication;

beforeAll(async () => {
    mod = await Test.createTestingModule({
        imports: [
            MongoModule.forRootAsync({
                useFactory: () => ({
                    uri: DBTEST,
                    exceptionFactory: (errors) =>
                        new BadRequestException(errors)
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
        const mongoModuleTest = mod.get<MongoDbModuleTest>(MongoDbModuleTest);
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

    it('should get an inverted relationship', async () => {
        const manager = mod.get<MongoManager>(getManagerToken());

        const entity = new EntityTest();
        entity.foo = 'bar';
        entity.bar = 'foo';
        await manager.save<EntityTest>(entity);

        const child = new EntityChildTest();
        child.foo = 'childInversed';
        child.parentId = entity._id;
        await manager.save(child);

        const children = await manager.getInversedRelationships(
            entity,
            EntityChildTest,
            'parentId'
        );
        expect(children).toHaveLength(1);
        expect((children[0] as EntityChildTest)._id).toEqual(child._id);
    });

    it('should serialize an entity', async () => {
        const manager = mod.get<MongoManager>(getManagerToken());

        const entity = await manager.findOne<EntityTest>(EntityTest, {});

        expect(entity._id).toBeInstanceOf(ObjectId);

        const obj: any = entity.serialize();
        expect(obj._id).toBeDefined();
        expect(typeof obj._id).toEqual('string');

        const reEntity = manager.getRepository(EntityTest).fromPlain(obj);
        expect(reEntity._id).toBeInstanceOf(ObjectId);
        expect(reEntity._id).toEqual(entity._id);

        const child = new EntityChildTest();
        child.parentId = entity._id;
        const objChild: any = child.serialize();
        expect(objChild.parentId).toEqual(entity._id.toHexString());

        const reChild = manager
            .getRepository(EntityChildTest)
            .fromPlain(objChild);
        expect(reChild.parentId).toBeInstanceOf(ObjectId);
        expect(reChild.parentId).toEqual(entity._id);
    });

    it('Should get/set relationship metadata', async () => {
        const entityChild = new EntityChildTest();
        const parentRelation = getRelationshipMetadata(entityChild, 'entities');
        expect(parentRelation).toBeDefined();
        expect(parentRelation.type).toBe(EntityRelationship);

        const parent = new EntityRelationship();
        const childRelation = getRelationshipMetadata(parent, 'child');
        expect(childRelation).toBeDefined();
        expect(childRelation.type).toBe(EntityChildTest);
    });

    it('Should get/set relationship metadata using string reference', async () => {
        const manager = mod.get<MongoManager>(getManagerToken());
        const parent = new EntityRelationship();
        const childRelationAsRef = getRelationshipMetadata(
            parent,
            'relationshipAsReference',
            manager
        );
        expect(childRelationAsRef).toBeDefined();
        expect(childRelationAsRef.type).toBe(EntityNestedTest);
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
        const repo = mod.get<MongoRepository<EntityTest>>(
            getRepositoryToken(EntityTest.name)
        );

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
                expect(res.body.item._id).toStrictEqual(
                    entity._id.toHexString()
                );
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
                expect(res.body.item._id).toStrictEqual(
                    entity._id.toHexString()
                );
                expect(res.body.uuid).toBeDefined();
                expect(res.body.reqUuid).toBeDefined();
                expect(res.body.reqUuid).toEqual(res.body.uuid);
                // should not match previous request
                expect(res.body.uuid).not.toEqual(uuid);
            });
    });
});

describe('Slugged entities', () => {
    test("Should slugify an entity's property correctly", () => {
        const entity = new EntitySlugTest('John', 'Smith');
        expect(entity.slug).toEqual('john-smith');
        expect(entity.slug2).toEqual('John-42');
    });

    test('Should expose slugs correctly via toJSON and serialize', () => {
        const entity = new EntitySlugTest('John', 'Smith');
        /* using setter should not expose hidden property __slug */
        entity.slug = 'foo-bar';
        entity._id = new ObjectID();

        const json = entity.toJSON() as any;
        expect(json.slug).toBeDefined();
        expect(json.__slug).toBeUndefined();
        expect(json.slug2).toBeDefined();

        const serialized = entity.serialize() as any;

        expect(serialized.slug).toBeDefined();
        expect(serialized.__slug).toBeUndefined();
        expect(serialized.slug2).toBeDefined();
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

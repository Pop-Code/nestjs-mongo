import { BadRequestException, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoClient } from 'mongodb';
import request from 'supertest';

import { DEFAULT_CONNECTION_NAME } from '../constants';
import { DataloaderService } from '../dataloader/service';
import { getConnectionToken, getManagerToken, getRepositoryToken, ObjectId } from '../helpers';
import { MongoManager } from '../manager';
import { MongoModule } from '../module';
import { MongoCoreModule } from '../module.core';
import {
    CascadeType,
    getChildrenRelationshipMetadata,
    getRelationshipCascadesMetadata,
    getRelationshipMetadata,
    getRelationshipsCascadesMetadata,
} from '../relationship/metadata';
import { MongoRepository } from '../repository';
import { MongoDbModuleTest } from './module';
import { RelationshipEntityLevel1Test } from './module/cascade/level1';
import { RelationshipEntityLevel1WithChildrenTest } from './module/cascade/level1WithChildren';
import { RelationshipEntityLevel2Test } from './module/cascade/level2';
import { RelationshipEntityLevel3Test } from './module/cascade/level3';
import { EntityChildTest } from './module/child';
import { TestController } from './module/controller';
import { EntityTest, TEST_COLLECTION_NAME } from './module/entity';
import {
    ChildDynamicRelationship,
    DynamicRelationshipType,
    ParentDynamicRelationship1,
    ParentDynamicRelationship2,
} from './module/entity.dynamic.relationship';
import { EntityWithIndexTest } from './module/entity.index';
import { EntityNestedTest } from './module/entity.nested';
import { EntityRelationship } from './module/entity.relationship';
import { EntityUniqueRelationship } from './module/entity.relationship.unique';

export const DBTEST =
    'mongodb://localhost:27017/nestjs-mongo-test?retryWrites=false';
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

        if (parent === undefined) {
            throw new Error('no parent');
        }

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
        expect(children[0]._id).toEqual(child._id);
    });

    it('should serialize an entity', async () => {
        const manager = mod.get<MongoManager>(getManagerToken());

        const entity = await manager.findOne<EntityTest>(EntityTest, {});
        if (entity === undefined) {
            throw new Error('no entity');
        }
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

        /* nested toJSON */
        const nested = new EntityNestedTest();
        const objNested: any = nested.toJSON();
        expect(objNested.nestedPropTest).toEqual('nested-prop-test');
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

describe('Relationships cascades', () => {
    it('should have children relationship defined', () => {
        const childrenRelationsLevel2 = getChildrenRelationshipMetadata(
            RelationshipEntityLevel2Test
        );
        expect(childrenRelationsLevel2).toHaveLength(1);
        expect(childrenRelationsLevel2[0].property).toBe('parentId');

        const childrenRelationsLevel3 = getChildrenRelationshipMetadata(
            RelationshipEntityLevel3Test
        );
        expect(childrenRelationsLevel3).toHaveLength(1);
        expect(childrenRelationsLevel3[0].property).toBe('parentId');
    });

    it('should have relationships cascades', () => {
        const relsCascadesMetadata = getRelationshipsCascadesMetadata(
            RelationshipEntityLevel1Test
        );
        if (relsCascadesMetadata === undefined) {
            throw Error('No cascades defined for RelationshipEntityLevel1Test');
        }
        expect(relsCascadesMetadata).toBeInstanceOf(Array);
        expect(relsCascadesMetadata).toHaveLength(1);
        expect(relsCascadesMetadata[0].model).toBe(
            RelationshipEntityLevel2Test
        );
        expect(relsCascadesMetadata[0].cascade).toHaveLength(1);
        expect(relsCascadesMetadata[0].cascade[0]).toBe(CascadeType.DELETE);
        const relCascades = getRelationshipCascadesMetadata(
            RelationshipEntityLevel1Test,
            RelationshipEntityLevel2Test
        );
        expect(relCascades?.model).toBe(RelationshipEntityLevel2Test);
        expect(relCascades?.property).toBe('parentId');
        expect(relCascades?.cascade).toHaveLength(1);
        expect(relCascades?.cascade[0]).toBe(CascadeType.DELETE);
    });

    it('should execute relationships cascades', async () => {
        const em = mod.get<MongoManager>(getManagerToken());

        // create a first level
        const level1 = new RelationshipEntityLevel1Test();
        await em.save(level1);

        // create two entity as child
        const level2 = new RelationshipEntityLevel2Test();
        level2.parentId = level1._id;
        await em.save(level2);

        const level3 = new RelationshipEntityLevel3Test();
        level3.parentId = level2._id;
        await em.save(level3);

        // now we delete the parent
        await em.deleteOne(RelationshipEntityLevel1Test, level1);

        // level1 and level2 and level3 should be deleted
        const searchLevel1 = await em.findOne(RelationshipEntityLevel1Test, {
            _id: level1._id
        });
        expect(searchLevel1).toBeUndefined();

        const searchLevel2 = await em.findOne(RelationshipEntityLevel2Test, {
            _id: level2._id
        });
        expect(searchLevel2).toBeUndefined();

        const searchLevel3 = await em.findOne(RelationshipEntityLevel3Test, {
            _id: level3._id
        });
        expect(searchLevel3).toBeUndefined();
    });

    it('should execute relationships cascades for a array relationship', async () => {
        const em = mod.get<MongoManager>(getManagerToken());

        const child1 = new EntityTest();
        child1.foo = 'bar';
        child1.bar = 'foo';
        await em.save(child1);

        const child2 = new EntityTest();
        child2.foo = 'bar';
        child2.bar = 'foo';
        await em.save(child2);

        const childrenIds = [child1._id, child2._id];
        const parent = new RelationshipEntityLevel1WithChildrenTest();
        parent.children = childrenIds;
        await em.save(parent);

        await em.deleteOne(RelationshipEntityLevel1WithChildrenTest, parent);

        const searchChildren = await em.find(EntityTest, {
            _id: { $in: childrenIds }
        });
        const emptyChildren = await searchChildren.toArray();
        expect(emptyChildren).toHaveLength(0);
    });
});
describe('Dynamic Relationship with cascades', () => {
    it('should create an entity with dynamic relationship metadata', async () => {
        const em = mod.get<MongoManager>(getManagerToken());

        const parent1 = new ParentDynamicRelationship1();
        parent1.foo = 'bar';
        await em.save(parent1);

        const child1 = new ChildDynamicRelationship();
        child1.parentId = parent1._id;
        child1.parentType =
            DynamicRelationshipType.EntityParentDynamicRelationship1;

        await em.save(child1);

        const rel1 = await em.getRelationship(child1, 'parentId');
        expect(rel1 instanceof ParentDynamicRelationship1).toBe(true);
        expect(rel1._id.equals(parent1._id)).toBe(true);

        const parent2 = new ParentDynamicRelationship2();
        parent2.foo = 'bar';
        parent2.bar = 'foo';
        await em.save(parent2);

        const child2 = new ChildDynamicRelationship();
        child2.parentId = parent2._id;
        child2.parentType =
            DynamicRelationshipType.EntityParentDynamicRelationship2;
        await em.save(child2);

        const rel2 = await em.getRelationship(child2, 'parentId');
        expect(rel2 instanceof ParentDynamicRelationship2).toBe(true);
        expect(rel2._id.equals(parent2._id)).toBe(true);

        // deleting should cascade
        await em.deleteOne(ParentDynamicRelationship1, { _id: parent1._id });
        const notFoundChild1 = await em.getRelationship(child1, 'parentId');
        expect(notFoundChild1).toBeUndefined();

        await em.deleteOne(ParentDynamicRelationship2, { _id: parent2._id });
        const notFoundChild2 = await em.getRelationship(child2, 'parentId');
        expect(notFoundChild2).toBeUndefined();
    });
});

describe('Indexes', () => {
    it('should define an index for a property', async () => {
        const em = mod.get<MongoManager>(getManagerToken());
        const indexes = await em.getCollection(EntityWithIndexTest).indexes();
        expect(indexes).toHaveLength(2);
        expect(indexes[1].unique).toBe(true);
    });

    it('should define an index for a relationship', async () => {
        const em = mod.get<MongoManager>(getManagerToken());
        const indexes = await em
            .getCollection(EntityUniqueRelationship)
            .indexes();

        expect(indexes).toHaveLength(3);
        expect(indexes[1].unique).toBe(true);
        expect(indexes[1].sparse).toBe(true);
        expect(indexes[1].key.child).toBe(1);

        expect(indexes[2].unique).toBe(true);
        expect(indexes[2].sparse).toBe(true);
        expect(indexes[2].key.child).toBe(1);
        expect(indexes[2].key.child2).toBe(1);
    });
});

describe('Mongo sessions support', () => {
    it('should throw while attempting to read a relationship created during a session without passing session object', async () => {
        const manager = mod.get<MongoManager>(getManagerToken());
        const session = manager.getClient().startSession();

        await expect(
            session.withTransaction(
                async () => {
                    const entity = new EntityTest();
                    entity.foo = 'bar';
                    entity.bar = 'foo';
                    await manager.save<EntityTest>(entity, {
                        mongoOperationOptions: { session }
                    });

                    const child = new EntityChildTest();
                    child.foo = 'child';
                    child.parentId = entity._id;

                    /* SESSION OBJECT INTENTIONALY OMITTED IN SAVE */
                    await manager.save(child);
                },
                {
                    readPreference: 'primary',
                    readConcern: { level: 'local' },
                    writeConcern: { w: 'majority' }
                }
            )
        ).rejects.toThrow();

        session.endSession();
    });

    it('should resolve a relationship created during a session when passing session object', async () => {
        const manager = mod.get<MongoManager>(getManagerToken());
        const session = manager.getClient().startSession();

        let entityTest;
        let entityChildTest;

        await expect(
            session.withTransaction(
                async () => {
                    const entity = new EntityTest();
                    entity.foo = 'bar';
                    entity.bar = 'foo';
                    entityTest = await manager.save<EntityTest>(entity, {
                        mongoOperationOptions: { session }
                    });
                    const child = new EntityChildTest();
                    child.foo = 'child';
                    child.parentId = entity._id;

                    entityChildTest = await manager.save(child, {
                        mongoOperationOptions: { session }
                    });
                },
                {
                    readPreference: 'primary',
                    readConcern: { level: 'local' },
                    writeConcern: { w: 'majority' }
                }
            )
        ).resolves.toBeTruthy();

        const entityTestCheck = await manager
            .getCollection(EntityTest)
            .find({ _id: entityTest._id }, { session })
            .next();

        const entityChildTestCheck = await manager
            .getCollection(EntityChildTest)
            .find({ _id: entityChildTest._id }, { session })
            .next();

        expect(entityChildTestCheck.__session).toBeUndefined();
        expect(entityTestCheck.__session).toBeUndefined();

        session.endSession();
    });
});

afterAll(async () => {
    try {
        const em = mod.get<MongoManager>(getManagerToken());
        const entities = [
            EntityTest,
            EntityChildTest,
            EntityRelationship,
            EntityNestedTest,
            ChildDynamicRelationship,
            ParentDynamicRelationship1,
            ParentDynamicRelationship2,
            RelationshipEntityLevel1Test,
            RelationshipEntityLevel2Test,
            RelationshipEntityLevel3Test,
            RelationshipEntityLevel1WithChildrenTest,
            EntityWithIndexTest,
            EntityUniqueRelationship
        ];

        for (const entity of entities) {
            await em.getCollection(entity).drop();
        }
        await mod.close();
    } catch (e) {
        console.log(e);
    }
});

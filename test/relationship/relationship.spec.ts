import { NestApplication } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ClassConstructor } from 'class-transformer';
import { ValidationError } from 'class-validator';
import { ObjectId } from 'mongodb';

import {
    CascadeType,
    EntityInterface,
    EntityManager,
    getEntityManagerToken,
    getRelationshipCascadesMetadata,
    getRelationshipMetadata,
    getRelationshipMetadataList,
    getRelationshipsCascadesMetadata,
    MongoModule,
} from '../../src';
import { DBTEST } from '../constants';
import { EntityTest } from '../entity/entity';
import {
    ChildDynamicRelationship,
    DynamicRelationshipType,
    ParentDynamicRelationship1,
    ParentDynamicRelationship2,
} from './cascade/entity.dynamic.relationship';
import { RelationshipEntityLevel1Test } from './cascade/level1';
import { RelationshipEntityLevel1WithChildrenTest } from './cascade/level1WithChildren';
import { RelationshipEntityLevel2Test } from './cascade/level2';
import { RelationshipEntityLevel3Test } from './cascade/level3';
import { EntityRelationship } from './entity.relationship';
import { EntityRelationshipBar } from './entity.relationship.bar';
import { EntityRelationshipFoo } from './entity.relationship.foo';

let app: NestApplication;
let em: EntityManager;
const uri = DBTEST + '-relationship';

beforeAll(async () => {
    const mod = await Test.createTestingModule({
        imports: [
            MongoModule.forRootAsync({
                useFactory: () => ({
                    uri,
                    exceptionFactory: (errors) => errors
                })
            }),
            MongoModule.forFeature({
                models: [
                    EntityTest,
                    EntityRelationship,
                    EntityRelationshipFoo,
                    EntityRelationshipBar,
                    RelationshipEntityLevel1Test,
                    RelationshipEntityLevel1WithChildrenTest,
                    RelationshipEntityLevel2Test,
                    RelationshipEntityLevel3Test,
                    ParentDynamicRelationship1,
                    ParentDynamicRelationship2,
                    ChildDynamicRelationship
                ]
            })
        ]
    }).compile();
    app = mod.createNestApplication();
    await app.init();
    em = app.get(getEntityManagerToken());
});

function testEntityRelationship(Model: ClassConstructor<EntityInterface>) {
    it(`${Model.name} should have relationship metadata defined (parent)`, () => {
        const metadata = getRelationshipMetadata(Model, 'parent');
        expect(metadata.type).toBe(EntityTest);
        expect(metadata.isArray).toBe(false);
    });
    it(`${Model.name} should have relationship metadata defined using string reference (parentAsReference)`, () => {
        const metadata = getRelationshipMetadata(Model, 'parentAsReference', em);
        expect(metadata.type).toBe(EntityTest);
        expect(metadata.isArray).toBe(false);
    });
    it(`${Model.name} should have relationship metadata defined (children)`, () => {
        const metadata = getRelationshipMetadata(Model, 'children');
        expect(metadata.type).toBe(EntityTest);
        expect(metadata.isArray).toBe(true);
    });
    it(`${Model.name} should have relationship metadata defined using string reference (childrenAsReference)`, () => {
        const metadata = getRelationshipMetadata(Model, 'childrenAsReference', em);
        expect(metadata.type).toBe(EntityTest);
        expect(metadata.isArray).toBe(true);
    });
}

describe('Relationship', () => {
    describe('Decorator', () => {
        describe('EntityRelationship', () => {
            testEntityRelationship(EntityRelationship);
            it('EntityRelationship should not have relationship metadata defined by a class that is extending it (EntityRelationshipFoo)', () => {
                expect.assertions(1);
                try {
                    getRelationshipMetadata(EntityRelationship, 'extendedFoo');
                } catch (e) {
                    expect(e.message).toContain(
                        `Can not get relationship metadata for property "extendedFoo" on "EntityRelationship"`
                    );
                }
            });
            it('EntityRelationship should not have relationship metadata defined by a class that is extending it (EntityRelationshipBar)', () => {
                expect.assertions(1);
                try {
                    getRelationshipMetadata(EntityRelationship, 'extendedBar');
                } catch (e) {
                    expect(e.message).toContain(
                        `Can not get relationship metadata for property "extendedBar" on "EntityRelationship"`
                    );
                }
            });
            it('EntityRelationship should not have child relationship metadata defined by a class that is extending it (EntityRelationshipFoo)', () => {
                const metadata = getRelationshipMetadataList(EntityRelationship).find(
                    (m) => m.property === 'extendedFoo'
                );
                expect(metadata).toBeUndefined();
            });
        });
        describe('EntityRelationshipFoo', () => {
            testEntityRelationship(EntityRelationshipFoo);
            it('EntityRelationshipFoo should have relationship metadata defined from self definition and from extended class EntityRelationship', () => {
                const metadataParentAsReference = getRelationshipMetadata(EntityRelationshipFoo, 'extendedFoo', em);
                expect(metadataParentAsReference.type).toBe(EntityTest);
                expect(metadataParentAsReference.isArray).toBe(false);
            });
        });
        describe('EntityRelationshipBar', () => {
            testEntityRelationship(EntityRelationshipBar);
            it('EntityRelationshipFoo should have relationship metadata defined from self definition and from extended class EntityRelationship', () => {
                const metadataParentAsReference = getRelationshipMetadata(EntityRelationshipBar, 'extendedBar', em);
                expect(metadataParentAsReference.type).toBe(EntityTest);
                expect(metadataParentAsReference.isArray).toBe(true);
            });
        });
        describe('IsValidRelationship', () => {
            describe('EntityRelationship', () => {
                it('should throw an error if relationship is invalid (parent)', async () => {
                    const entityRelationShip = new EntityRelationship();
                    entityRelationShip.property = 'test';
                    entityRelationShip.parent = new ObjectId(); // fake id
                    expect.assertions(4);
                    try {
                        await em.save(entityRelationShip);
                    } catch (e) {
                        expect(e).toHaveLength(1);
                        expect(e[0]).toBeInstanceOf(ValidationError);
                        expect(e[0].property).toBe('parent');
                        expect(e[0].constraints).toHaveProperty('IsValidRelationship');
                    }
                });

                it('should test an EntityRelationship with a single relationship save and query (parent)', async () => {
                    const entityTest = new EntityTest();
                    entityTest.foo = 'foo';
                    entityTest.bar = 'bar';
                    await em.save(entityTest);

                    const entityRelationShip = new EntityRelationship();
                    entityRelationShip.property = 'test_with_single_parent';
                    entityRelationShip.parent = entityTest._id;
                    await em.save(entityRelationShip);

                    const found = await em.findOne(EntityRelationship, { parent: entityTest._id });
                    expect(found?._id.toHexString()).toBe(entityRelationShip._id.toHexString());

                    const relation = await em.getRelationship<EntityTest>(found, 'parent');
                    expect(relation?._id.toHexString()).toBe(entityTest._id.toHexString());
                });

                it('should throw an error if relationships are invalid (children)', async () => {
                    const entityRelationShip = new EntityRelationship();
                    entityRelationShip.property = 'test';
                    entityRelationShip.children = [new ObjectId()];
                    expect.assertions(4);
                    try {
                        await em.save(entityRelationShip);
                    } catch (e) {
                        expect(e).toHaveLength(1);
                        expect(e[0]).toBeInstanceOf(ValidationError);
                        expect(e[0].property).toBe('children');
                        expect(e[0].constraints).toHaveProperty('IsValidRelationship');
                    }
                });

                it('should test an EntityRelationship with an array relationship save and query (children)', async () => {
                    const entityTest1 = new EntityTest();
                    entityTest1.foo = 'foo';
                    entityTest1.bar = 'bar';
                    await em.save(entityTest1);

                    const entityTest2 = new EntityTest();
                    entityTest2.foo = 'foo';
                    entityTest2.bar = 'bar';
                    await em.save(entityTest2);

                    const entityRelationShip = new EntityRelationship();
                    entityRelationShip.property = 'test_with_children';
                    entityRelationShip.children = [entityTest1._id, entityTest2._id];
                    await em.save(entityRelationShip);

                    const found = await em.findOne(EntityRelationship, { property: entityRelationShip.property });

                    expect(found?._id.toHexString()).toBe(entityRelationShip._id.toHexString());

                    const relations = await em.getRelationships<EntityTest>(found, 'children');
                    expect(
                        relations.filter(
                            (r) =>
                                r instanceof EntityTest &&
                                (r._id.equals(entityTest1._id) || r._id.equals(entityTest2._id))
                        )
                    ).toHaveLength(2);
                });
            });
        });
    });
    describe('Cascades', () => {
        it('should have children relationship defined', () => {
            const childrenRelationsLevel2 = getRelationshipMetadataList(RelationshipEntityLevel2Test);
            expect(childrenRelationsLevel2).toHaveLength(1);
            expect(childrenRelationsLevel2[0].property).toBe('parentId');

            const childrenRelationsLevel3 = getRelationshipMetadataList(RelationshipEntityLevel3Test);
            expect(childrenRelationsLevel3).toHaveLength(1);
            expect(childrenRelationsLevel3[0].property).toBe('parentId');
        });

        it('should have relationships cascades', () => {
            const relsCascadesMetadata = getRelationshipsCascadesMetadata(RelationshipEntityLevel1Test);
            if (relsCascadesMetadata === undefined) {
                throw Error('No cascades defined for RelationshipEntityLevel1Test');
            }
            expect(relsCascadesMetadata).toBeInstanceOf(Array);
            expect(relsCascadesMetadata).toHaveLength(1);
            expect(relsCascadesMetadata[0].model).toBe(RelationshipEntityLevel2Test);
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
});

describe('Dynamic Relationship', () => {
    describe('Decorator', () => {
        it('should create an entity with dynamic relationship metadata', async () => {
            const parent1 = new ParentDynamicRelationship1();
            parent1.foo = 'bar';
            await em.save(parent1);

            const child1 = new ChildDynamicRelationship();
            child1.parentId = parent1._id;
            child1.parentType = DynamicRelationshipType.EntityParentDynamicRelationship1;
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
            child2.parentType = DynamicRelationshipType.EntityParentDynamicRelationship2;
            await em.save(child2);

            const rel2 = await em.getRelationship(child2, 'parentId');
            expect(rel2 instanceof ParentDynamicRelationship2).toBe(true);
            expect(rel2._id.equals(parent2._id)).toBe(true);
        });
    });

    describe('Cascades', () => {
        it('should create an entity with dynamic relationship metadata', async () => {
            const parent1 = new ParentDynamicRelationship1();
            parent1.foo = 'bar';
            await em.save(parent1);

            const child1 = new ChildDynamicRelationship();
            child1.parentId = parent1._id;
            child1.parentType = DynamicRelationshipType.EntityParentDynamicRelationship1;
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
            child2.parentType = DynamicRelationshipType.EntityParentDynamicRelationship2;
            await em.save(child2);

            const rel2 = await em.getRelationship(child2, 'parentId');
            expect(rel2 instanceof ParentDynamicRelationship2).toBe(true);
            expect(rel2._id.equals(parent2._id)).toBe(true);

            await em.deleteOne(ParentDynamicRelationship1, { _id: parent1._id });
            const notFoundChild1 = await em.getRelationship(child1, 'parentId');
            expect(notFoundChild1).toBeUndefined();

            await em.deleteOne(ParentDynamicRelationship2, { _id: parent2._id });
            const notFoundChild2 = await em.getRelationship(child2, 'parentId');
            expect(notFoundChild2).toBeUndefined();
        });
    });
});

afterAll(async () => {
    await em.getDatabase().dropDatabase();
    await app.close();
});

import 'reflect-metadata';

import { NestApplication } from '@nestjs/core';
import { Test } from '@nestjs/testing';

import { EntityManager, getEntityManagerToken, getIndexMetadatas, MongoModule } from '../../src';
import { DBTEST } from '../constants';
import { EntityTest } from '../entity/entity';
import { EntityRelationship } from '../relationship/entity.relationship';
import { EntityRelationshipBar } from '../relationship/entity.relationship.bar';
import { EntityRelationshipFoo } from '../relationship/entity.relationship.foo';
import { EntityWithIndexTest } from './entity.index';
import { EntityWithIndexChildTest } from './entity.index.child';
import { EntityWithIndexChild2Test } from './entity.index.child2';

let app: NestApplication;
let em: EntityManager;
const uri = DBTEST + '-index';
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
                    EntityWithIndexTest,
                    EntityWithIndexChildTest,
                    EntityWithIndexChild2Test,
                    EntityRelationship,
                    EntityRelationshipFoo,
                    EntityRelationshipBar
                ]
            })
        ]
    }).compile();
    app = mod.createNestApplication();
    await app.init();
    em = app.get(getEntityManagerToken());
});
describe('Indexes', () => {
    describe('Metadata', () => {
        it('EntityWithIndexTest should have an unique index defined', () => {
            const indexs = getIndexMetadatas(EntityWithIndexTest);
            expect(indexs).toHaveLength(1);
            expect(indexs[0].property).toBe('foo');
            expect(indexs[0].description).toHaveProperty('unique', true);
        });
        describe('Indexes on extended classes', () => {
            it('EntityWithIndexChildTest should have an 2 indexs defined', () => {
                const indexs = getIndexMetadatas(EntityWithIndexChildTest);
                expect(indexs).toHaveLength(2);
                expect(indexs[0].property).toBe('bar');
                expect(JSON.stringify(indexs[0].description)).toBe('{}');

                expect(indexs[1].property).toBe('foo');
                expect(indexs[1].description).toHaveProperty('unique', true);
            });
            it('EntityWithIndexChild2Test should have an 2 indexs defined', () => {
                const indexs = getIndexMetadatas(EntityWithIndexChild2Test);
                expect(indexs).toHaveLength(4);

                expect(indexs[0].property).toBe('bar2');
                expect(indexs[0].description).toHaveProperty('unique', true);

                expect(indexs[1].property).toBe('parent');
                expect(indexs[1].description?.key).toHaveProperty('parent');
                expect(indexs[1].description?.name).toBe('EntityWithIndexChild2Test_parent_relationship');
                expect(indexs[1].description?.unique).toBe(true);

                expect(indexs[2].property).toBe('parent2');
                expect(indexs[2].description?.key).toHaveProperty('parent2');
                expect(indexs[2].description?.name).toBe('EntityWithIndexChild2Test_parent2_relationship');

                expect(indexs[3].property).toBe('foo');
                expect(indexs[3].description).toHaveProperty('unique', true);
            });
        });
    });
    describe('MongoDB', () => {
        it('should create indexs on EntityWithIndexTest collection', async () => {
            const indexes = await em.getCollection(EntityWithIndexTest).indexes({ full: true });
            expect(indexes).toHaveLength(2); // _id and foo
            expect(indexes[0].name).toBe('_id_');

            expect(indexes[1].name).toBe('foo_1');
            expect(indexes[1].key.foo).toBe(1);
            expect(indexes[1].unique).toBe(true);
        });
        it('should create indexs on EntityWithIndexChildTest collection', async () => {
            const indexes = await em.getCollection(EntityWithIndexChildTest).indexes();
            expect(indexes).toHaveLength(3); // _id and foo
            expect(indexes[0].name).toBe('_id_');

            expect(indexes[1].name).toBe('bar_1');
            expect(indexes[1].key.bar).toBe(1);

            expect(indexes[2].name).toBe('foo_1');
            expect(indexes[2].key.foo).toBe(1);
            expect(indexes[2].unique).toBe(true);
        });
        it('should create indexs on EntityRelationship collection', async () => {
            const indexes = await em.getCollection(EntityRelationship).indexes();
            expect(indexes).toHaveLength(5);
            expect(indexes[0].name).toBe('_id_');

            expect(indexes[1].name).toBe('EntityRelationship_parent_relationship');
            expect(indexes[1].key.parent).toBe(1);

            expect(indexes[2].name).toBe('EntityRelationship_parentAsReference_relationship');
            expect(indexes[2].key.parentAsReference).toBe(1);

            expect(indexes[3].name).toBe('EntityRelationship_children_relationship');
            expect(indexes[3].key.children).toBe(1);

            expect(indexes[4].name).toBe('EntityRelationship_childrenAsReference_relationship');
            expect(indexes[4].key.childrenAsReference).toBe(1);
        });
        describe('Indexes on extended classes', () => {
            it('should create indexs on extending class EntityRelationshipFoo collection', async () => {
                const indexes = await em.getCollection(EntityRelationshipFoo).indexes();
                expect(indexes).toHaveLength(6);
                expect(indexes[0].name).toBe('_id_');

                expect(indexes[1].name).toBe('EntityRelationshipFoo_extendedFoo_relationship');
                expect(indexes[1].key.extendedFoo).toBe(1);

                expect(indexes[2].name).toBe('EntityRelationship_parent_relationship');
                expect(indexes[2].key.parent).toBe(1);

                expect(indexes[3].name).toBe('EntityRelationship_parentAsReference_relationship');
                expect(indexes[3].key.parentAsReference).toBe(1);

                expect(indexes[4].name).toBe('EntityRelationship_children_relationship');
                expect(indexes[4].key.children).toBe(1);

                expect(indexes[5].name).toBe('EntityRelationship_childrenAsReference_relationship');
                expect(indexes[5].key.childrenAsReference).toBe(1);
            });
            it('should create indexs on extending class EntityRelationshipBar collection', async () => {
                const indexes = await em.getCollection(EntityRelationshipBar).indexes();

                expect(indexes).toHaveLength(6);
                expect(indexes[0].name).toBe('_id_');

                expect(indexes[1].name).toBe('EntityRelationshipBar_extendedBar_relationship');
                expect(indexes[1].key.extendedBar).toBe(1);

                expect(indexes[2].name).toBe('EntityRelationship_parent_relationship');
                expect(indexes[2].key.parent).toBe(1);

                expect(indexes[3].name).toBe('EntityRelationship_parentAsReference_relationship');
                expect(indexes[3].key.parentAsReference).toBe(1);

                expect(indexes[4].name).toBe('EntityRelationship_children_relationship');
                expect(indexes[4].key.children).toBe(1);

                expect(indexes[5].name).toBe('EntityRelationship_childrenAsReference_relationship');
                expect(indexes[5].key.childrenAsReference).toBe(1);
            });
        });
    });
});
afterAll(async () => {
    await em.getDatabase().dropDatabase();
    await app.close();
});

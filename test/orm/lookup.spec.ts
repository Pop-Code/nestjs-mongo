import 'reflect-metadata';

import { TestingModule } from '@nestjs/testing';
import { ObjectId } from 'mongodb';

import { EntityManager } from '../../src';
import { EntityTest } from '../entity/entity';
import {
    ChildDynamicRelationship,
    ParentDynamicRelationship1,
    ParentDynamicRelationship2
} from '../relationship/cascade/entity.dynamic.relationship';
import { EntityRelationship } from '../relationship/entity.relationship';
import { SoftDeleted, SoftDeletedChild } from './entities';
import { closeModule, createModule } from './setup';

let ctx: { mod: TestingModule; em: EntityManager };
let em: EntityManager;
let parents: EntityTest[];

beforeAll(async () => {
    ctx = await createModule('orm-lookup', [
        EntityTest,
        EntityRelationship,
        SoftDeleted,
        SoftDeletedChild,
        ParentDynamicRelationship1,
        ParentDynamicRelationship2,
        ChildDynamicRelationship
    ]);
    em = ctx.em;
    parents = await em.insertMany(['1', '2', '3'].map((foo) => Object.assign(new EntityTest(), { foo, bar: foo })));
    await em.insertMany(
        [
            Object.assign(new EntityRelationship(), {
                property: 'a',
                parent: parents[0]._id,
                parentAsReference: parents[1]._id,
                children: [parents[1]._id, parents[2]._id, new ObjectId()]
            }),
            Object.assign(new EntityRelationship(), { property: 'b' })
        ],
        { skipValidation: true }
    );
});

describe('findWithRelationships', () => {
    it('should load the relationships of the entities', async () => {
        const results = await em.findWithRelationships(
            EntityRelationship,
            {},
            ['parent', 'parentAsReference', 'children'],
            {
                sort: { property: 1 }
            }
        );
        expect(results).toHaveLength(2);

        const [a, b] = results;
        expect(a.entity).toBeInstanceOf(EntityRelationship);
        expect(a.entity).not.toHaveProperty('__relationship_parent');
        expect(a.relationships.parent).toBeInstanceOf(EntityTest);
        if (a.relationships.parent instanceof EntityTest) {
            expect(a.relationships.parent.foo).toBe('1');
        }
        expect((a.relationships.parentAsReference as EntityTest).foo).toBe('2');
        expect((a.relationships.children as EntityTest[]).map((c) => c.foo).sort()).toEqual(['2', '3']);

        expect(b.relationships.parent).toBeUndefined();
        expect(b.relationships.children).toEqual([]);
    });

    it('should filter, sort, skip and limit the entities', async () => {
        const results = await em.getRepository(EntityRelationship).findWithRelationships({}, ['parent'], {
            sort: { property: -1 },
            skip: 1,
            limit: 1
        });
        expect(results.map((r) => r.entity.property)).toEqual(['a']);
        expect(await em.findWithRelationships(EntityRelationship, { property: 'none' }, ['parent'])).toEqual([]);
    });

    it('should ignore the soft deleted relationships', async () => {
        const [parent] = await em.insertMany([Object.assign(new SoftDeleted(), { name: 'p' })]);
        await em.save(Object.assign(new SoftDeletedChild(), { name: 'c', parentId: parent._id }));
        await em.updateOne(SoftDeleted, { _id: parent._id }, { $set: { deletedAt: new Date() } });

        const [child] = await em.findWithRelationships(SoftDeletedChild, {}, ['parentId']);
        expect(child.relationships.parentId).toBeUndefined();
        const [withDeleted] = await em.findWithRelationships(SoftDeletedChild, {}, ['parentId'], {
            withDeleted: true
        });
        expect(withDeleted.relationships.parentId).toBeInstanceOf(SoftDeleted);
    });

    it('should reject the dynamic relationships', async () => {
        await expect(em.findWithRelationships(ChildDynamicRelationship, {}, ['parentId'])).rejects.toThrow();
    });
});

afterAll(async () => {
    await closeModule(ctx);
});

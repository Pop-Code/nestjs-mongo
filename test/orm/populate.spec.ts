import 'reflect-metadata';

import { TestingModule } from '@nestjs/testing';
import { ObjectId } from 'mongodb';

import { EntityManager } from '../../src';
import { EntityTest } from '../entity/entity';
import { EntityRelationship } from '../relationship/entity.relationship';
import {
    ChildDynamicRelationship,
    DynamicRelationshipType,
    ParentDynamicRelationship1,
    ParentDynamicRelationship2
} from '../relationship/cascade/entity.dynamic.relationship';
import { closeModule, createModule } from './setup';

let ctx: { mod: TestingModule; em: EntityManager };
let em: EntityManager;

beforeAll(async () => {
    ctx = await createModule('orm-populate', [
        EntityTest,
        EntityRelationship,
        ParentDynamicRelationship1,
        ParentDynamicRelationship2,
        ChildDynamicRelationship
    ]);
    em = ctx.em;
});

describe('populate', () => {
    it('should load the relationships of a list of entities with one query', async () => {
        const [p1, p2] = await em.insertMany([
            Object.assign(new EntityTest(), { foo: '1', bar: '1' }),
            Object.assign(new EntityTest(), { foo: '2', bar: '2' })
        ]);
        const children = [
            Object.assign(new EntityRelationship(), { property: 'a', parent: p1._id, children: [p1._id, p2._id] }),
            Object.assign(new EntityRelationship(), { property: 'b', parent: p1._id }),
            Object.assign(new EntityRelationship(), { property: 'c' })
        ];
        const find = jest.spyOn(em, 'findByIds');
        const parents = await em.populate<EntityTest>(children, 'parent');
        expect(find).toHaveBeenCalledTimes(1);
        expect(parents.size).toBe(1);
        expect(parents.get(p1._id.toHexString())).toBeInstanceOf(EntityTest);

        const related = await em.getRepository(EntityRelationship).populate<EntityTest>(children, 'children');
        expect([...related.keys()].sort()).toEqual([p1._id.toHexString(), p2._id.toHexString()].sort());
        find.mockRestore();

        expect((await em.populate(children.slice(2), 'parent')).size).toBe(0);
    });

    it('should load the dynamic relationships from each model', async () => {
        const [p1] = await em.insertMany([Object.assign(new ParentDynamicRelationship1(), { foo: '1' })]);
        const [p2] = await em.insertMany([Object.assign(new ParentDynamicRelationship2(), { foo: '2', bar: '2' })]);
        const children = [
            Object.assign(new ChildDynamicRelationship(), {
                parentId: p1._id,
                parentType: DynamicRelationshipType.EntityParentDynamicRelationship1
            }),
            Object.assign(new ChildDynamicRelationship(), {
                parentId: p2._id,
                parentType: DynamicRelationshipType.EntityParentDynamicRelationship2
            })
        ];
        const parents = await em.populate(children, 'parentId');
        expect(parents.get(p1._id.toHexString())).toBeInstanceOf(ParentDynamicRelationship1);
        expect(parents.get(p2._id.toHexString())).toBeInstanceOf(ParentDynamicRelationship2);
    });
});

describe('IsValidRelationship on an array', () => {
    it('should report the invalid ids with their index', async () => {
        const [p1] = await em.insertMany([Object.assign(new EntityTest(), { foo: '1', bar: '1' })]);
        const missing = new ObjectId();
        const errors = await em.validate(
            Object.assign(new EntityRelationship(), { property: 'a', children: [p1._id, missing] })
        );
        expect(errors[0].constraints?.IsValidRelationship).toBe(
            `The property children contains an invalid relationship ${missing.toHexString()} at index 1`
        );
    });
});

afterAll(async () => {
    await closeModule(ctx);
});

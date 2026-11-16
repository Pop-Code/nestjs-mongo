import 'reflect-metadata';

import { TestingModule } from '@nestjs/testing';

import { EntityManager } from '../../src';
import { Customer, SoftDeleted, SoftDeletedChild, softDeleteEvents } from './entities';
import { closeModule, createModule } from './setup';

let ctx: { mod: TestingModule; em: EntityManager };
let em: EntityManager;

beforeAll(async () => {
    ctx = await createModule('orm-soft', [Customer, SoftDeleted, SoftDeletedChild]);
    em = ctx.em;
});

beforeEach(async () => {
    softDeleteEvents.length = 0;
    await em.getCollection(SoftDeleted).deleteMany({});
    await em.getCollection(SoftDeletedChild).deleteMany({});
});

const create = async (...names: string[]) =>
    await em.insertMany(names.map((name) => Object.assign(new SoftDeleted(), { name })));

describe('soft delete', () => {
    it('should set the deletedAt date, run the hooks, and ignore the deleted documents', async () => {
        const [a] = await create('a', 'b');
        const result = await em.deleteOne(SoftDeleted, { _id: a._id });
        expect(result.deletedCount).toBe(1);
        expect(softDeleteEvents).toEqual(['beforeDelete:a', 'afterDelete:a']);

        const doc = await em.getCollection(SoftDeleted).findOne({ _id: a._id });
        expect(doc?.deletedAt).toBeInstanceOf(Date);
        expect(await em.findById(SoftDeleted, a._id!)).toBeUndefined();
        expect(await em.count(SoftDeleted)).toBe(1);
        expect(await em.exists(SoftDeleted, { name: 'a' })).toBe(false);
        expect(await em.distinct(SoftDeleted, 'name')).toEqual(['b']);
        expect(await em.aggregate(SoftDeleted).toArray()).toHaveLength(1);
        expect((await em.paginate(SoftDeleted)).count).toBe(1);
    });

    it('should include the deleted documents with withDeleted, or a filter on the property', async () => {
        const [a] = await create('a', 'b');
        await em.deleteOne(SoftDeleted, { _id: a._id });
        expect(await em.count(SoftDeleted, {}, { withDeleted: true })).toBe(2);
        expect((await em.findById(SoftDeleted, a._id!, { withDeleted: true }))?.deletedAt).toBeInstanceOf(Date);
        expect(await em.count(SoftDeleted, { deletedAt: { $exists: true } })).toBe(1);
        expect(await em.aggregate(SoftDeleted, [], { withDeleted: true }).toArray()).toHaveLength(2);
    });

    it('should not update the deleted documents', async () => {
        const [a] = await create('a');
        await em.deleteOne(SoftDeleted, { _id: a._id });
        expect((await em.updateMany(SoftDeleted, {}, { $set: { name: 'x' } })).matchedCount).toBe(0);
        expect(
            (await em.updateMany(SoftDeleted, {}, { $set: { name: 'x' } }, { withDeleted: true })).matchedCount
        ).toBe(1);
    });

    it('should restore the deleted documents', async () => {
        const [a] = await create('a');
        await em.deleteMany(SoftDeleted, {});
        expect((await em.restore(SoftDeleted, { _id: a._id })).modifiedCount).toBe(1);
        const restored = await em.findById(SoftDeleted, a._id!);
        expect(restored?.deletedAt).toBeUndefined();
        await expect(em.restore(Customer, {})).rejects.toThrow('restore() requires a @DeletedAt() property');
    });

    it('should soft delete many documents', async () => {
        await create('a', 'b', 'c');
        const result = await em.deleteMany(SoftDeleted, { name: { $in: ['a', 'b'] } });
        expect(result.deletedCount).toBe(2);
        expect(softDeleteEvents).toEqual(['beforeDelete:a', 'beforeDelete:b', 'afterDelete:a', 'afterDelete:b']);
        expect(await em.count(SoftDeleted)).toBe(1);
        expect(await em.count(SoftDeleted, {}, { withDeleted: true })).toBe(3);
    });

    it('should remove the documents with hard: true', async () => {
        const [a] = await create('a');
        await em.deleteOne(SoftDeleted, { _id: a._id });
        await em.deleteOne(SoftDeleted, { _id: a._id }, { hard: true, withDeleted: true });
        expect(await em.count(SoftDeleted, {}, { withDeleted: true })).toBe(0);
    });

    it('should not run the hooks with skipHooks', async () => {
        await create('a');
        await em.deleteMany(SoftDeleted, {}, { skipHooks: true });
        expect(softDeleteEvents).toEqual([]);
    });

    it('should resolve deletedCount 0 when no document matches', async () => {
        expect((await em.deleteOne(SoftDeleted, { name: 'none' })).deletedCount).toBe(0);
        expect((await em.deleteMany(SoftDeleted, { name: 'none' })).deletedCount).toBe(0);
    });

    it('should soft delete the cascades', async () => {
        const [parent] = await create('parent');
        await em.save(Object.assign(new SoftDeletedChild(), { name: 'child', parentId: parent._id }));
        await em.deleteOne(SoftDeleted, { _id: parent._id });
        expect(await em.count(SoftDeletedChild)).toBe(0);
        expect(await em.count(SoftDeletedChild, {}, { withDeleted: true })).toBe(1);
    });

    it('should find and delete a document', async () => {
        await create('a', 'b');
        const soft = await em.findOneAndDelete(SoftDeleted, { name: 'a' });
        expect(soft?.deletedAt).toBeInstanceOf(Date);
        expect(softDeleteEvents).toEqual(['afterDelete:a']);
        expect(await em.count(SoftDeleted, {}, { withDeleted: true })).toBe(2);

        const hard = await em.findOneAndDelete(SoftDeleted, { name: 'b' }, { hard: true });
        expect(hard?.name).toBe('b');
        expect(await em.count(SoftDeleted, {}, { withDeleted: true })).toBe(1);
        expect(await em.findOneAndDelete(SoftDeleted, { name: 'none' })).toBeUndefined();
    });
});

describe('delete without soft delete', () => {
    it('should remove the documents of a model without @DeletedAt()', async () => {
        const customer = await em.save(Object.assign(new Customer(), { name: 'a' }));
        expect((await em.findOneAndDelete(Customer, { _id: customer._id }))?.name).toBe('a');
        expect(await em.count(Customer)).toBe(0);
    });
});

afterAll(async () => {
    await closeModule(ctx);
});

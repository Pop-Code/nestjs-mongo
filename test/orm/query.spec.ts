import 'reflect-metadata';

import { TestingModule } from '@nestjs/testing';
import { ObjectId } from 'mongodb';

import { DuplicateKeyException, EntityManager, EntityNotFoundException, runInSessionContext } from '../../src';
import { Customer, UniqueEmail, Versioned } from './entities';
import { closeModule, createModule } from './setup';

let ctx: { mod: TestingModule; em: EntityManager };
let em: EntityManager;
let customers: Customer[];

beforeAll(async () => {
    ctx = await createModule('orm-query', [Customer, Versioned, UniqueEmail]);
    em = ctx.em;
    customers = await em.insertMany(
        ['a', 'b', 'c', 'd', 'e'].map((name, index) =>
            Object.assign(new Customer(), { name, visits: index, tags: index % 2 === 0 ? ['even'] : ['odd'] })
        )
    );
});

describe('find helpers', () => {
    it('should find by id (ObjectId or string) and by ids', async () => {
        expect((await em.findById(Customer, customers[0]._id!))?.name).toBe('a');
        expect((await em.findById(Customer, customers[1]._id!.toHexString()))?.name).toBe('b');
        expect(await em.findById(Customer, new ObjectId())).toBeUndefined();
        const found = await em.findByIds(Customer, [customers[0]._id!, customers[2]._id!.toHexString()]);
        expect(found.map((c) => c.name).sort()).toEqual(['a', 'c']);
    });

    it('should throw an EntityNotFoundException with findOneOrFail', async () => {
        expect((await em.findOneOrFail(Customer, { name: 'a' })).name).toBe('a');
        const error = await em.findOneOrFail(Customer, { name: 'none' }).catch((e: unknown) => e);
        expect(error).toBeInstanceOf(EntityNotFoundException);
        expect((error as EntityNotFoundException).getStatus()).toBe(404);
        expect((error as EntityNotFoundException).filter).toEqual({ name: 'none' });
    });

    it('should test the existence, count and list the distinct values', async () => {
        expect(await em.exists(Customer, { name: 'a' })).toBe(true);
        expect(await em.exists(Customer, { name: 'none' })).toBe(false);
        expect(await em.count(Customer)).toBe(5);
        expect(await em.estimatedCount(Customer)).toBe(5);
        expect((await em.distinct(Customer, 'tags')).sort()).toEqual(['even', 'odd']);
        expect(await em.distinct(Customer, 'name', { visits: { $gte: 3 } })).toEqual(['d', 'e']);
    });

    it('should iterate a cursor of entities', async () => {
        const names: string[] = [];
        for await (const customer of await em.find(Customer, {}, { sort: { name: 1 } })) {
            expect(customer).toBeInstanceOf(Customer);
            names.push(customer.name);
        }
        expect(names).toEqual(['a', 'b', 'c', 'd', 'e']);
    });
});

describe('aggregate', () => {
    it('should return the documents, or the instances of a class', async () => {
        const groups = await em
            .aggregate<{ _id: string; count: number }>(Customer, [
                { $unwind: '$tags' },
                { $group: { _id: '$tags', count: { $sum: 1 } } },
                { $sort: { _id: 1 } }
            ])
            .toArray();
        expect(groups).toEqual([
            { _id: 'even', count: 3 },
            { _id: 'odd', count: 2 }
        ]);

        const loaded = await em.aggregate(Customer, [{ $match: { name: 'a' } }], { as: Customer }).toArray();
        expect(loaded[0]).toBeInstanceOf(Customer);
        expect(loaded[0].__hooks).toEqual(['afterLoad']);
        expect(await em.aggregate(Customer).toArray()).toHaveLength(5);
    });
});

describe('paginate', () => {
    it('should return a page and the count', async () => {
        const page = await em.paginate(Customer, { tags: 'even' }, { skip: 1, limit: 1, sort: { name: -1 } });
        expect(page.count).toBe(3);
        expect(page.data.map((c) => c.name)).toEqual(['c']);
        expect((await em.paginate(Customer)).data).toHaveLength(5);
    });

    it('should paginate in a transaction', async () => {
        const page = await em.withTransaction(async () => await em.paginate(Customer, {}, { limit: 2 }));
        expect(page.count).toBe(5);
        expect(page.data).toHaveLength(2);
    });

    it('should paginate by cursor', async () => {
        const first = await em.paginateByCursor(Customer, {}, { limit: 2 });
        expect(first.data.map((c) => c.name)).toEqual(['a', 'b']);
        const second = await em.paginateByCursor(Customer, {}, { limit: 2, after: first.next });
        expect(second.data.map((c) => c.name)).toEqual(['c', 'd']);
        const last = await em.paginateByCursor(Customer, {}, { limit: 2, after: second.next });
        expect(last.data.map((c) => c.name)).toEqual(['e']);
        expect(last.next).toBeUndefined();

        const desc = await em.paginateByCursor(Customer, { tags: 'even' }, { limit: 1, direction: -1 });
        expect(desc.data.map((c) => c.name)).toEqual(['e']);
        const descNext = await em.paginateByCursor(Customer, { tags: 'even' }, { direction: -1, after: desc.next });
        expect(descNext.data.map((c) => c.name)).toEqual(['c', 'a']);
    });
});

describe('updates', () => {
    it('should update with operators and set updatedAt', async () => {
        const result = await em.updateOne(Customer, { name: 'a' }, { $inc: { visits: 10 } });
        expect(result.modifiedCount).toBe(1);
        const doc = await em.getCollection(Customer).findOne({ name: 'a' });
        expect(doc?.visits).toBe(10);
        expect(doc?.updatedAt).toBeInstanceOf(Date);
    });

    it('should not set updatedAt with timestamps: false, and run pipeline updates', async () => {
        await em.updateMany(Customer, { tags: 'odd' }, { $set: { nickname: 'odd' } }, { timestamps: false });
        expect(await em.count(Customer, { nickname: 'odd', updatedAt: { $exists: false } })).toBe(2);
        await em.updateMany(Customer, { tags: 'odd' }, [{ $set: { nickname: { $toUpper: '$name' } } }]);
        expect(await em.distinct(Customer, 'nickname', { tags: 'odd' })).toEqual(['B', 'D']);
    });

    it('should increment the version of a model with @Version()', async () => {
        const doc = await em.save(Object.assign(new Versioned(), { title: 'a' }));
        await em.updateOne(Versioned, { _id: doc._id }, { $set: { title: 'b' } });
        expect((await em.findById(Versioned, doc._id))?.version).toBe(2);
        await em.updateOne(Versioned, { _id: doc._id }, { $set: { title: 'c', version: 10 } });
        expect((await em.findById(Versioned, doc._id))?.version).toBe(10);
    });

    it('should find and update a document', async () => {
        const updated = await em.findOneAndUpdate(Customer, { name: 'c' }, { $set: { nickname: 'C' } });
        expect(updated).toBeInstanceOf(Customer);
        expect(updated?.nickname).toBe('C');
        const before = await em.findOneAndUpdate(
            Customer,
            { name: 'c' },
            { $set: { nickname: 'CC' } },
            { returnDocument: 'before' }
        );
        expect(before?.nickname).toBe('C');
        expect(await em.findOneAndUpdate(Customer, { name: 'none' }, { $set: { nickname: 'x' } })).toBeUndefined();
    });

    it('should upsert a document', async () => {
        const inserted = await em.upsert(Customer, { name: 'upserted' }, { nickname: 'new' });
        expect(inserted).toBeInstanceOf(Customer);
        expect(inserted.createdAt).toBeInstanceOf(Date);
        const updated = await em.upsert(Customer, { name: 'upserted' }, { nickname: 'changed' });
        expect(updated._id.equals(inserted._id)).toBe(true);
        expect(updated.nickname).toBe('changed');
        expect(updated.createdAt).toEqual(inserted.createdAt);
        await em.deleteOne(Customer, { name: 'upserted' });
    });

    it('should run bulk writes and map the duplicate key errors', async () => {
        const result = await em.bulkWrite(UniqueEmail, [
            { insertOne: { document: { email: 'bulk@a.b', createdAt: new Date() } } },
            { updateOne: { filter: { email: 'bulk@a.b' }, update: { $set: { updatedAt: new Date() } } } }
        ]);
        expect(result.insertedCount).toBe(1);
        expect(result.modifiedCount).toBe(1);
        await expect(
            em.bulkWrite(UniqueEmail, [{ insertOne: { document: { email: 'bulk@a.b', createdAt: new Date() } } }])
        ).rejects.toBeInstanceOf(DuplicateKeyException);
    });
});

describe('session context', () => {
    it('should run the queries in the session of the context', async () => {
        await runInSessionContext(async () => {
            const session = em.getClient().startSession();
            em.setSessionContext(session);
            expect(await em.exists(Customer, { name: 'a' })).toBe(true);
            expect(session.hasEnded).toBe(false);
            await session.endSession();
        });
    });
});

describe('ping', () => {
    it('should ping the server', async () => {
        expect(await em.ping()).toBe(true);
    });
});

afterAll(async () => {
    await closeModule(ctx);
});

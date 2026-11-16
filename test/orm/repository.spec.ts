import 'reflect-metadata';

import { TestingModule } from '@nestjs/testing';
import { ObjectId } from 'mongodb';

import { EntityManager, EntityRepository } from '../../src';
import { EntityTest } from '../entity/entity';
import { EntityRelationship } from '../relationship/entity.relationship';
import { Customer, SoftDeleted } from './entities';
import { closeModule, createModule } from './setup';

let ctx: { mod: TestingModule; em: EntityManager };
let repo: EntityRepository<Customer>;

beforeAll(async () => {
    ctx = await createModule('orm-repository', [Customer, SoftDeleted, EntityTest, EntityRelationship]);
    repo = ctx.em.getRepository(Customer);
});

const customer = (name: string) => Object.assign(new Customer(), { name });

describe('EntityRepository', () => {
    it('should write the entities', async () => {
        const saved = await repo.save(customer('a'));
        expect(saved._id).toBeInstanceOf(ObjectId);
        expect(await repo.saveMany([customer('b')])).toHaveLength(1);
        expect(await repo.insertMany([customer('c'), customer('d')])).toHaveLength(2);
        await repo.patch(saved, { nickname: 'A' });
        expect((await repo.findById(saved._id))?.nickname).toBe('A');
        expect(repo.getClassType()).toBe(Customer);
        expect(repo.getEm()).toBe(ctx.em);
    });

    it('should query the entities', async () => {
        const a = await repo.findOneOrFail({ name: 'a' });
        expect((await repo.findOne({ name: 'a' }))?._id.equals(a._id)).toBe(true);
        expect((await repo.findById(a._id.toHexString()))?.name).toBe('a');
        expect(await repo.findByIds([a._id])).toHaveLength(1);
        expect(await (await repo.find()).toArray()).toHaveLength(4);
        expect(await repo.count()).toBe(4);
        expect(await repo.estimatedCount()).toBe(4);
        expect(await repo.exists({ name: 'b' })).toBe(true);
        expect((await repo.distinct('name')).sort()).toEqual(['a', 'b', 'c', 'd']);
        expect(await repo.aggregate([{ $match: { name: 'a' } }]).toArray()).toHaveLength(1);
        expect((await repo.paginate({}, { limit: 2 })).count).toBe(4);
        expect((await repo.paginateByCursor({}, { limit: 3 })).data).toHaveLength(3);
        expect(await repo.validate(customer('ok'))).toEqual([]);
        expect(repo.fromPlain({ name: 'x' })).toBeInstanceOf(Customer);
        expect(repo.merge(customer('x'), { nickname: 'y' }).nickname).toBe('y');
    });

    it('should update the entities', async () => {
        expect((await repo.updateOne({ name: 'a' }, { $set: { visits: 1 } })).modifiedCount).toBe(1);
        expect((await repo.updateMany({}, { $inc: { visits: 1 } })).modifiedCount).toBe(4);
        expect((await repo.findOneAndUpdate({ name: 'a' }, { $inc: { visits: 1 } }))?.visits).toBe(3);
        expect((await repo.upsert({ name: 'e' }, { visits: 0 })).name).toBe('e');
        expect(
            (await repo.bulkWrite([{ updateOne: { filter: { name: 'e' }, update: { $set: { visits: 9 } } } }]))
                .modifiedCount
        ).toBe(1);
    });

    it('should delete the entities', async () => {
        expect((await repo.deleteOne({ name: 'e' })).deletedCount).toBe(1);
        expect((await repo.findOneAndDelete({ name: 'd' }))?.name).toBe('d');
        expect((await repo.deleteMany({ name: { $in: ['b', 'c'] } })).deletedCount).toBe(2);
        const soft = ctx.em.getRepository(SoftDeleted);
        await soft.save(Object.assign(new SoftDeleted(), { name: 's' }));
        await soft.deleteMany({});
        expect((await soft.restore({})).modifiedCount).toBe(1);
    });

    it('should load the relationships', async () => {
        const parent = await ctx.em.save(Object.assign(new EntityTest(), { foo: 'f', bar: 'b' }));
        const relationships = ctx.em.getRepository(EntityRelationship);
        const child = await relationships.save(
            Object.assign(new EntityRelationship(), { property: 'p', parent: parent._id, children: [parent._id] })
        );
        expect((await relationships.getRelationship<EntityTest>(child, 'parent'))?.foo).toBe('f');
        expect(await relationships.getRelationships<EntityTest>(child, 'children')).toHaveLength(1);
        expect((await relationships.populate<EntityTest>([child], 'parent')).size).toBe(1);
    });

    it('should watch the collection', async () => {
        const stream = repo.watch();
        expect(repo.getCollection().collectionName).toBe('ormCustomer');
        await stream.close();
    });
});

afterAll(async () => {
    await closeModule(ctx);
});

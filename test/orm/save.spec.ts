import 'reflect-metadata';

import { TestingModule } from '@nestjs/testing';
import { ObjectId } from 'mongodb';

import {
    DuplicateKeyException,
    EntityManager,
    EntityNotFoundException,
    EntityValidationException,
    OptimisticLockException
} from '../../src';
import { Address, Customer, UniqueEmail, Versioned, VipCustomer } from './entities';
import { closeModule, createModule } from './setup';

let ctx: { mod: TestingModule; em: EntityManager };
let em: EntityManager;

beforeAll(async () => {
    ctx = await createModule('orm-save', [Customer, VipCustomer, Versioned, UniqueEmail]);
    em = ctx.em;
});

const newCustomer = (data: Partial<Customer> = {}) => Object.assign(new Customer(), { name: 'Jane', ...data });
const raw = async (id: ObjectId) => await em.getCollection(Customer).findOne({ _id: id });

describe('save', () => {
    it('should insert a new entity, and run the hooks', async () => {
        const customer = await em.save(newCustomer({ name: 'Jane DOE' }));
        expect(customer._id).toBeInstanceOf(ObjectId);
        expect(customer.normalizedName).toBe('jane doe');
        expect(customer.__hooks).toEqual(['beforeInsert', 'afterInsert']);
        expect(await raw(customer._id)).toMatchObject({ name: 'Jane DOE', normalizedName: 'jane doe' });
    });

    it('should run the hooks of the parent classes first', async () => {
        const vip = await em.save(Object.assign(new VipCustomer(), { name: 'Vip', level: 'gold' }));
        expect(vip.__hooks).toEqual(['beforeInsert', 'vipBeforeInsert', 'afterInsert']);
    });

    it('should update an entity, unset its undefined properties and set updatedAt', async () => {
        const customer = await em.save(newCustomer({ nickname: 'J' }));
        customer.nickname = undefined;
        customer.name = 'John';
        await em.save(customer);
        expect(customer.updatedAt).toBeInstanceOf(Date);
        expect(customer.__hooks).toEqual(['beforeInsert', 'afterInsert', 'beforeUpdate', 'afterUpdate']);
        const doc = await raw(customer._id);
        expect(doc).not.toHaveProperty('nickname');
        expect(doc).toMatchObject({ name: 'John', normalizedName: 'john' });
    });

    it('should insert an entity with an _id set by the application', async () => {
        const _id = new ObjectId();
        await em.save(newCustomer({ _id }));
        expect(await raw(_id)).toMatchObject({ name: 'Jane' });
    });

    it('should save the embedded documents as plain objects, and load them as instances', async () => {
        const address = Object.assign(new Address(), { street: 's', city: 'c' });
        const customer = await em.save(newCustomer({ address, addresses: [address] }));
        expect(await raw(customer._id)).toMatchObject({ address: { street: 's', city: 'c' } });
        const found = await em.findById(Customer, customer._id);
        expect(found?.address).toBeInstanceOf(Address);
        expect(found?.addresses?.[0]).toBeInstanceOf(Address);
        expect(found?.__hooks).toEqual(['afterLoad']);
    });

    it('should not write the properties without decorators, and keep them on the entity', async () => {
        const customer = await em.save(newCustomer({ transient: 'kept' }));
        expect(customer.transient).toBe('kept');
        expect(await raw(customer._id)).not.toHaveProperty('transient');
    });

    it('should throw an EntityValidationException for an invalid entity', async () => {
        const error = await em.save(newCustomer({ name: 1 as unknown as string })).catch((e: unknown) => e);
        expect(error).toBeInstanceOf(EntityValidationException);
        expect((error as EntityValidationException).errors[0].property).toBe('name');
        expect((error as EntityValidationException).getStatus()).toBe(400);
    });

    it('should save without validation and without hooks', async () => {
        const customer = await em.save(newCustomer({ name: 1 as unknown as string }), {
            skipValidation: true,
            skipHooks: true
        });
        expect(customer.__hooks).toEqual([]);
        expect(await raw(customer._id)).toMatchObject({ name: 1 });
    });

    it('should throw a DuplicateKeyException on a unique index', async () => {
        await em.save(Object.assign(new UniqueEmail(), { email: 'a@b.c' }));
        const error = await em
            .save(Object.assign(new UniqueEmail(), { email: 'a@b.c' }), { skipValidation: true })
            .catch((e: unknown) => e);
        expect(error).toBeInstanceOf(DuplicateKeyException);
        expect((error as DuplicateKeyException).keyValue).toEqual({ email: 'a@b.c' });
        expect((error as DuplicateKeyException).getStatus()).toBe(409);
    });

    it('should throw for an entity that is not a registered model', async () => {
        class NotAModel {}
        await expect(em.save(new NotAModel() as unknown as Customer)).rejects.toThrow('Can not find model NotAModel');
    });
});

describe('patch', () => {
    it('should write only the changed properties', async () => {
        const customer = await em.save(newCustomer({ nickname: 'J', visits: 1 }));
        // changed by another process
        await em.getCollection(Customer).updateOne({ _id: customer._id }, { $set: { visits: 5 } });
        await em.patch(customer, { nickname: 'Jo', tags: ['a'] });
        expect(customer.nickname).toBe('Jo');
        expect(customer.__hooks.slice(-2)).toEqual(['beforeUpdate', 'afterUpdate']);
        expect(await raw(customer._id)).toMatchObject({ nickname: 'Jo', tags: ['a'], visits: 5 });
    });

    it('should remove the properties set to undefined', async () => {
        const customer = await em.save(newCustomer({ nickname: 'J' }));
        await em.patch(customer, { nickname: undefined });
        expect(await raw(customer._id)).not.toHaveProperty('nickname');
    });

    it('should validate the entity', async () => {
        const customer = await em.save(newCustomer());
        await expect(em.patch(customer, { visits: 'a' as unknown as number })).rejects.toBeInstanceOf(
            EntityValidationException
        );
    });

    it('should throw for an entity without _id, or a document that does not exist', async () => {
        await expect(em.patch(newCustomer(), { name: 'a' })).rejects.toThrow('patch() changes a saved entity');
        await expect(em.patch(newCustomer({ _id: new ObjectId() }), { name: 'a' })).rejects.toBeInstanceOf(
            EntityNotFoundException
        );
    });
});

describe('@Version()', () => {
    it('should set the version 1 on insert and increment it on update', async () => {
        const doc = await em.save(Object.assign(new Versioned(), { title: 'a' }));
        expect(doc.version).toBe(1);
        doc.title = 'b';
        await em.save(doc);
        expect(doc.version).toBe(2);
        await em.patch(doc, { title: 'c' });
        expect(doc.version).toBe(3);
        expect(await em.getCollection(Versioned).findOne({ _id: doc._id })).toMatchObject({ title: 'c', version: 3 });
    });

    it('should throw an OptimisticLockException when the document changed since it was loaded', async () => {
        const doc = await em.save(Object.assign(new Versioned(), { title: 'a' }));
        const copy = (await em.findById(Versioned, doc._id))!;
        copy.title = 'other';
        await em.save(copy);

        doc.title = 'stale';
        const error = await em.save(doc).catch((e: unknown) => e);
        expect(error).toBeInstanceOf(OptimisticLockException);
        expect((error as OptimisticLockException).getStatus()).toBe(409);
        expect(doc.version).toBe(1);
        await expect(em.patch(doc, { title: 'stale' })).rejects.toBeInstanceOf(OptimisticLockException);
        expect(await em.getCollection(Versioned).findOne({ _id: doc._id })).toMatchObject({ title: 'other' });
    });

    it('should insert a versioned entity with an _id and no version', async () => {
        const _id = new ObjectId();
        const doc = await em.save(Object.assign(new Versioned(), { _id, title: 'a' }));
        expect(doc.version).toBe(1);
        // a second entity without version conflicts with the existing document
        await expect(em.save(Object.assign(new Versioned(), { _id, title: 'b' }))).rejects.toBeInstanceOf(
            OptimisticLockException
        );
    });

    it('should not check the version of a model without @Version()', async () => {
        const customer = await em.save(newCustomer());
        expect(customer).not.toHaveProperty('version');
    });
});

describe('saveMany / insertMany', () => {
    it('should save the entities', async () => {
        const saved = await em.saveMany([newCustomer({ name: 'a' }), newCustomer({ name: 'b' })]);
        expect(saved.every((c) => c._id instanceof ObjectId)).toBe(true);
    });

    it('should insert the entities with one insertMany, and run the hooks', async () => {
        const inserted = await em.insertMany([newCustomer({ name: 'A' }), newCustomer({ name: 'B' })]);
        expect(inserted.map((c) => c.__hooks)).toEqual([
            ['beforeInsert', 'afterInsert'],
            ['beforeInsert', 'afterInsert']
        ]);
        expect(await em.count(Customer, { _id: { $in: inserted.map((c) => c._id) } })).toBe(2);
        expect(await em.insertMany([])).toEqual([]);
    });

    it('should set the version of the inserted entities', async () => {
        const [doc] = await em.insertMany([Object.assign(new Versioned(), { title: 'a' })]);
        expect(doc.version).toBe(1);
    });

    it('should reject the entities of different models, the saved entities, and the invalid entities', async () => {
        await expect(em.insertMany([newCustomer(), Object.assign(new Versioned(), { title: 'a' })])).rejects.toThrow(
            'inserts the entities of one model'
        );
        await expect(em.insertMany([newCustomer({ _id: new ObjectId() })])).rejects.toThrow('has an _id');
        await expect(em.insertMany([newCustomer({ name: 1 as unknown as string })])).rejects.toBeInstanceOf(
            EntityValidationException
        );
    });

    it('should map the duplicate key errors', async () => {
        await expect(
            em.insertMany(
                [
                    Object.assign(new UniqueEmail(), { email: 'x@y.z' }),
                    Object.assign(new UniqueEmail(), { email: 'x@y.z' })
                ],
                { skipValidation: true }
            )
        ).rejects.toBeInstanceOf(DuplicateKeyException);
    });
});

afterAll(async () => {
    await closeModule(ctx);
});

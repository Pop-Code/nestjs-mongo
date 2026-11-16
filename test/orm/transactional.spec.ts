import 'reflect-metadata';

import { TestingModule } from '@nestjs/testing';

import { EntityManager, getEntityManager, Transactional } from '../../src';
import { Customer } from './entities';
import { closeModule, createModule } from './setup';

let ctx: { mod: TestingModule; em: EntityManager };
let em: EntityManager;

class CustomerService {
    calls = 0;

    @Transactional()
    async createTwo(fail = false) {
        this.calls += 1;
        await em.save(Object.assign(new Customer(), { name: 'tx1' }));
        await this.createOne('tx2');
        if (fail) throw new Error('abort');
        return 'done';
    }

    @Transactional({ transactionOptions: { readPreference: 'primary' } })
    async createOne(name: string) {
        expect(em.getSessionContext()?.session.inTransaction()).toBe(true);
        return await em.save(Object.assign(new Customer(), { name }));
    }

    @Transactional({ connectionName: 'unknown' })
    async noConnection() {
        return await Promise.resolve();
    }
}

const service = new CustomerService();

beforeAll(async () => {
    ctx = await createModule('orm-transactional', [Customer]);
    em = ctx.em;
});

beforeEach(async () => {
    await em.getCollection(Customer).deleteMany({});
});

describe('@Transactional()', () => {
    it('should commit, and run the nested call in the same transaction', async () => {
        const startSession = jest.spyOn(em.getClient(), 'startSession');
        expect(await service.createTwo()).toBe('done');
        expect(startSession).toHaveBeenCalledTimes(1);
        startSession.mockRestore();
        expect(service.calls).toBe(1);
        expect(await em.count(Customer, { name: { $in: ['tx1', 'tx2'] } })).toBe(2);
        expect(em.getSessionContext()).toBeUndefined();
    });

    it('should roll back when the method throws', async () => {
        await expect(service.createTwo(true)).rejects.toThrow('abort');
        expect(await em.count(Customer)).toBe(0);
    });

    it('should throw without a connection', async () => {
        await expect(service.noConnection()).rejects.toThrow('@Transactional(): no connection unknown');
    });
});

describe('withTransaction', () => {
    it('should return the result of the function', async () => {
        const customer = await em.withTransaction(
            async () => await em.save(Object.assign(new Customer(), { name: 'w' }))
        );
        expect(customer.name).toBe('w');
        expect(await em.count(Customer)).toBe(1);
    });

    it('should register the manager of the connection', () => {
        expect(getEntityManager()).toBe(em);
        expect(em.getConnectionName()).toBe('nestjs-mongo:connection:default');
    });
});

afterAll(async () => {
    await closeModule(ctx);
    expect(getEntityManager()).toBeUndefined();
});

import 'reflect-metadata';

import { NotFoundException } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { ChangeStreamDocument, WithId } from 'mongodb';

import {
    EntityManager,
    EntityRepository,
    EntityService,
    Filter,
    HistoryAction,
    HistoryActions,
    PaginatedData
} from '../../src';
import { Customer } from './entities';
import { closeModule, createModule } from './setup';

class CustomerFilter extends Filter {
    name?: string;

    toQuery() {
        return this.name !== undefined ? { name: this.name } : {};
    }
}

class CustomerService extends EntityService<Customer> {
    constructor(repository: EntityRepository<Customer>) {
        super();
        this.repository = repository;
    }
}

let ctx: { mod: TestingModule; em: EntityManager };
let service: CustomerService;

beforeAll(async () => {
    ctx = await createModule('orm-service', [Customer]);
    service = new CustomerService(ctx.em.getRepository(Customer));
});

describe('EntityService', () => {
    it('should create, get, update and delete an entity', async () => {
        expect(await service.create({ name: 'draft' })).toBeInstanceOf(Customer);
        const created = (await service.create({ name: 'a', visits: 1 }, true)) as WithId<Customer>;
        expect((await service.get(created._id)).name).toBe('a');

        const changed = await service.update(created._id, { nickname: 'A' });
        expect(changed.nickname).toBe('A');
        // changed by another process: not overwritten by the update
        await ctx.em.getCollection(Customer).updateOne({ _id: created._id }, { $set: { visits: 5 } });
        await service.update(created._id, { nickname: 'B', address: { street: 's', city: 'c' } as never }, true);
        const doc = await ctx.em.getCollection(Customer).findOne({ _id: created._id });
        expect(doc).toMatchObject({ nickname: 'B', visits: 5, address: { street: 's', city: 'c' } });

        await service.delete(created._id);
        await expect(service.get(created._id)).rejects.toBeInstanceOf(NotFoundException);
        await expect(service.delete(created._id)).rejects.toBeInstanceOf(NotFoundException);
        expect(service.getRepository()).toBeInstanceOf(EntityRepository);
    });

    it('should list the entities with a filter', async () => {
        await ctx.em.insertMany(['x', 'y', 'z'].map((name) => Object.assign(new Customer(), { name })));
        const filter = Object.assign(new CustomerFilter(), { limit: 2, orderBy: ['name:desc'] });
        const page = await service.list(filter, PaginatedData);
        expect(page).toBeInstanceOf(PaginatedData);
        expect(page.count).toBe(3);
        expect(page.data.map((c: Customer) => c.name)).toEqual(['z', 'y']);
        expect((await service.list(Object.assign(new CustomerFilter(), { name: 'x' }), PaginatedData)).count).toBe(1);
        expect(filter.getSortForAggregation()).toEqual({ name: -1 });
        expect(Object.assign(new Filter(), { orderBy: undefined }).getSort()).toEqual([]);
        expect(Object.assign(new Filter(), { orderBy: undefined }).getSortForAggregation()).toEqual({});
    });

    it('should add an history action', () => {
        const customer = Object.assign(new Customer(), { history: new HistoryActions() });
        const date = new Date(0);
        service.addHistory(customer, 'created', date).addHistory(customer, 'updated');
        expect(customer.history.getActions().map((a: HistoryAction) => a.action)).toEqual(['created', 'updated']);
        expect(customer.history.getActions()[0].date).toBe(date);
        customer.history.clear();
        expect(customer.history.getActions()).toEqual([]);
        service.addHistory(new Customer(), 'ignored');
    });

    it('should subscribe to the changes', async () => {
        const events: Array<{ name: string; change: ChangeStreamDocument<WithId<Customer>> }> = [];
        const stream = service.subscribe((name, change) => events.push({ name, change }));
        await new Promise((resolve) => setTimeout(resolve, 500));
        await ctx.em.save(Object.assign(new Customer(), { name: 'watched' }));
        const until = Date.now() + 5000;
        while (events.length === 0 && Date.now() < until) {
            await new Promise((resolve) => setTimeout(resolve, 50));
        }
        await stream.close();
        expect(events[0].name).toBe('onInsertCustomer');
        expect((events[0].change as { fullDocument: Customer }).fullDocument).toBeInstanceOf(Customer);
    });
});

afterAll(async () => {
    await closeModule(ctx);
});

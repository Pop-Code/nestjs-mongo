import 'reflect-metadata';

import { TestingModule } from '@nestjs/testing';

import { EntityManager, Migration, MigrationRunner } from '../../src';
import { Customer } from './entities';
import { closeModule, createModule } from './setup';

let ctx: { mod: TestingModule; em: EntityManager };
let runner: MigrationRunner;

const migrations: Migration[] = [
    {
        name: '001-insert',
        up: async (db) => {
            await db.collection('ormCustomer').insertOne({ name: 'migrated', createdAt: new Date() });
        },
        down: async (db) => {
            await db.collection('ormCustomer').deleteOne({ name: 'migrated' });
        }
    },
    {
        name: '002-status',
        transaction: true,
        up: async (db, session) => {
            await db.collection('ormCustomer').updateMany({}, { $set: { nickname: 'active' } }, { session });
        },
        down: async (db, session) => {
            await db.collection('ormCustomer').updateMany({}, { $unset: { nickname: '' } }, { session });
        }
    }
];

beforeAll(async () => {
    ctx = await createModule('orm-migration', [Customer]);
    runner = new MigrationRunner(ctx.em);
});

describe('MigrationRunner', () => {
    it('should run the pending migrations once', async () => {
        expect((await runner.pending(migrations)).map((m) => m.name)).toEqual(['001-insert', '002-status']);
        expect(await runner.up(migrations)).toEqual(['001-insert', '002-status']);
        expect(await runner.up(migrations)).toEqual([]);
        expect((await runner.executed()).map((m) => m.name)).toEqual(['001-insert', '002-status']);
        expect(await ctx.em.count(Customer, { name: 'migrated', nickname: 'active' })).toBe(1);
    });

    it('should revert the last migrations', async () => {
        expect(await runner.down(migrations)).toEqual(['002-status']);
        expect(await ctx.em.count(Customer, { nickname: 'active' })).toBe(0);
        expect(await runner.down(migrations, 5)).toEqual(['001-insert']);
        expect(await ctx.em.count(Customer)).toBe(0);
        expect(await runner.executed()).toEqual([]);
    });

    it('should not revert a migration without down', async () => {
        const noDown = [{ name: 'no-down', up: async () => {} }];
        await runner.up(noDown);
        await expect(runner.down(noDown)).rejects.toThrow('The migration no-down can not be reverted');
        await expect(runner.down([])).rejects.toThrow('can not be reverted');
        await ctx.em.getDatabase().collection('migrations').deleteMany({});
    });

    it('should reject the duplicate names', async () => {
        await expect(runner.up([migrations[0], migrations[0]])).rejects.toThrow('must be unique');
    });

    it('should not run when another process holds the lock', async () => {
        await ctx.em.getDatabase().collection<{ _id: string }>('migrations_lock').insertOne({ _id: 'lock' });
        await expect(runner.up(migrations)).rejects.toThrow('The migrations are running in another process');
        await ctx.em.getDatabase().collection<{ _id: string }>('migrations_lock').deleteOne({ _id: 'lock' });
    });

    it('should release the lock when a migration fails', async () => {
        const failing = [
            {
                name: 'failing',
                up: async () => {
                    throw new Error('failed');
                }
            }
        ];
        await expect(runner.up(failing)).rejects.toThrow('failed');
        expect(await runner.up([])).toEqual([]);
    });
});

afterAll(async () => {
    await closeModule(ctx);
});

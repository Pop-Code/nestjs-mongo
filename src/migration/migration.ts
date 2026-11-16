import Debug from 'debug';
import { ClientSession, Db } from 'mongodb';

import { DEBUG } from '../constants';
import { EntityManager } from '../entity/manager';

/** A migration of the database. */
export interface Migration {
    /** The unique name of the migration, the migrations run in the order of the list. */
    name: string;
    up: (db: Db, session?: ClientSession) => Promise<void>;
    down?: (db: Db, session?: ClientSession) => Promise<void>;
    /** Run the migration in a transaction (requires a replica set). */
    transaction?: boolean;
}

/** A migration executed on the database. */
export interface ExecutedMigration {
    name: string;
    executedAt: Date;
}

/**
 * Runs the migrations of a connection, and records the executed migrations in a collection (`migrations` by default).
 * A lock prevents two processes from running the migrations at the same time.
 *
 * ```ts
 * const runner = new MigrationRunner(em);
 * await runner.up([{ name: '001-add-status', up: async (db) => { await db.collection('users').updateMany({}, { $set: { status: 'active' } }); } }]);
 * ```
 */
export class MigrationRunner {
    protected log = Debug(DEBUG + ':MigrationRunner');

    constructor(
        protected readonly em: EntityManager,
        protected readonly collectionName = 'migrations'
    ) {}

    protected get collection() {
        return this.em.getDatabase().collection<ExecutedMigration>(this.collectionName);
    }

    protected get lockCollection() {
        return this.em.getDatabase().collection<{ _id: string; lockedAt: Date }>(`${this.collectionName}_lock`);
    }

    /** The executed migrations, in their execution order. */
    async executed(): Promise<ExecutedMigration[]> {
        return await this.collection
            .find({}, { projection: { _id: 0 } })
            .sort({ executedAt: 1, _id: 1 })
            .toArray();
    }

    /** The migrations of the list that are not executed. */
    async pending(migrations: Migration[]): Promise<Migration[]> {
        const executed = new Set((await this.executed()).map((m) => m.name));
        return migrations.filter((m) => !executed.has(m.name));
    }

    protected async withLock<T>(fn: () => Promise<T>): Promise<T> {
        try {
            await this.lockCollection.insertOne({ _id: 'lock', lockedAt: new Date() });
        } catch (e) {
            if (e?.code === 11000) {
                throw Object.assign(
                    new Error(`The migrations are running in another process (${this.collectionName}_lock)`),
                    { cause: e }
                );
            }
            throw e;
        }
        try {
            return await fn();
        } finally {
            await this.lockCollection.deleteOne({ _id: 'lock' });
        }
    }

    protected async run(migration: Migration, fn: (db: Db, session?: ClientSession) => Promise<void>) {
        const db = this.em.getDatabase();
        if (migration.transaction === true) {
            await this.em.withTransaction(async (session) => await fn(db, session));
        } else {
            await fn(db);
        }
    }

    /** Runs the pending migrations, returns their names. */
    async up(migrations: Migration[]): Promise<string[]> {
        const names = migrations.map((m) => m.name);
        if (new Set(names).size !== names.length) {
            throw new Error('The names of the migrations must be unique');
        }
        return await this.withLock(async () => {
            const executed: string[] = [];
            for (const migration of await this.pending(migrations)) {
                this.log('Running migration %s', migration.name);
                await this.run(migration, migration.up);
                await this.collection.insertOne({ name: migration.name, executedAt: new Date() });
                executed.push(migration.name);
            }
            return executed;
        });
    }

    /** Reverts the last executed migrations (1 by default), returns their names. */
    async down(migrations: Migration[], steps = 1): Promise<string[]> {
        return await this.withLock(async () => {
            const reverted: string[] = [];
            const executed = (await this.executed()).reverse().slice(0, steps);
            for (const { name } of executed) {
                const migration = migrations.find((m) => m.name === name);
                if (migration?.down === undefined) {
                    throw new Error(`The migration ${name} can not be reverted (no down function)`);
                }
                this.log('Reverting migration %s', name);
                await this.run(migration, migration.down);
                await this.collection.deleteOne({ name });
                reverted.push(name);
            }
            return reverted;
        });
    }
}

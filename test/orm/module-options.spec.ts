import 'reflect-metadata';

import { Injectable, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import {
    EntityManager,
    EntityRepository,
    getEntityManagerToken,
    InjectRepository,
    MongoModule,
    MongoModuleOptions,
    MongoOptionsFactory
} from '../../src';
import { DBTEST } from '../constants';
import { Customer, Person } from './entities';
import { closeModule, createModule } from './setup';

@Injectable()
class ConfigService implements MongoOptionsFactory {
    createMongoOptions(): MongoModuleOptions {
        return { uri: `${DBTEST}-orm-options` };
    }
}

@Module({ providers: [ConfigService], exports: [ConfigService] })
class ConfigModule {}

@Injectable()
class UsesRepository {
    constructor(@InjectRepository(Customer) readonly repository: EntityRepository<Customer>) {}
}

describe('forRootAsync', () => {
    it('should create the options with useClass', async () => {
        const mod = await Test.createTestingModule({
            imports: [
                MongoModule.forRootAsync({ useClass: ConfigService }),
                MongoModule.forFeature({ models: [Customer] })
            ],
            providers: [UsesRepository]
        }).compile();
        await mod.init();
        const em = mod.get<EntityManager>(getEntityManagerToken());
        expect(em.getDatabase().databaseName).toBe('nestjs-mongo-orm-options');
        expect(mod.get(UsesRepository).repository).toBeInstanceOf(EntityRepository);
        await closeModule({ mod, em });
    });

    it('should create the options with useExisting', async () => {
        const mod = await Test.createTestingModule({
            imports: [MongoModule.forRootAsync({ imports: [ConfigModule], useExisting: ConfigService })]
        }).compile();
        await mod.init();
        const em = mod.get<EntityManager>(getEntityManagerToken());
        expect(await em.ping()).toBe(true);
        await mod.close();
    });

    it('should require a factory', () => {
        expect(() => MongoModule.forRootAsync({})).toThrow('requires useFactory, useClass or useExisting');
    });
});

describe('indexes', () => {
    it('should create the class and property indexes', async () => {
        const ctx = await createModule('orm-indexes', [Person]);
        const indexes = await ctx.em.getCollection(Person).listIndexes().toArray();
        expect(indexes.find((i) => i.name === 'person_name')?.key).toEqual({ lastName: 1, firstName: -1 });
        expect(indexes.find((i) => i.name === 'expiresAt_1')?.expireAfterSeconds).toBe(3600);
        await ctx.mod.close();
    });

    it('should not create the indexes with autoIndex: false', async () => {
        const ctx = await createModule('orm-noindex', [Person], { autoIndex: false });
        expect(await ctx.em.getCollection(Person).listIndexes().toArray()).toHaveLength(1);
        await closeModule(ctx);
    });

    it('should drop the indexes that are not declared, and recreate the changed ones with syncIndexes', async () => {
        const setup = await createModule('orm-indexes', [Customer], { autoIndex: false });
        const collection = setup.em.getCollection(Person);
        await collection.createIndex({ stale: 1 });
        await collection.dropIndex('expiresAt_1');
        await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 10 });
        await setup.mod.close();

        const ctx = await createModule('orm-indexes', [Person], { syncIndexes: true });
        const indexes = await ctx.em.getCollection(Person).listIndexes().toArray();
        expect(indexes.map((i) => i.name).sort()).toEqual(['_id_', 'expiresAt_1', 'person_name']);
        expect(indexes.find((i) => i.name === 'expiresAt_1')?.expireAfterSeconds).toBe(3600);
        await closeModule(ctx);
    });

    it('should throw when an index can not be created', async () => {
        const ctx = await createModule('orm-badindex', [Customer]);
        await ctx.em.getCollection(Person).createIndex({ lastName: 1, firstName: -1 }, { name: 'other_name' });
        await expect(ctx.em.createIndexs(Person)).rejects.toThrow('Unable to create index on collection');
        await closeModule(ctx);
    });
});

describe('schemaValidation', () => {
    it('should reject the invalid documents', async () => {
        const ctx = await createModule('orm-schema', [Customer], { schemaValidation: {} });
        await expect(ctx.em.getCollection(Customer).insertOne({ name: 1, createdAt: new Date() })).rejects.toThrow(
            'Document failed validation'
        );
        await ctx.em.getCollection(Customer).insertOne({ name: 'ok', createdAt: new Date() });
        await closeModule(ctx);
    });
});

describe('migrations', () => {
    it('should run the migrations when the module starts', async () => {
        const up = jest.fn(async () => {});
        const ctx = await createModule('orm-migrations', [Customer], {
            migrations: [{ name: '001', up }],
            migrationsRun: true
        });
        expect(up).toHaveBeenCalledTimes(1);
        await closeModule(ctx);
    });
});

describe('change streams', () => {
    it('should close the change streams when the module is destroyed', async () => {
        const ctx = await createModule('orm-streams', [Customer]);
        const stream = ctx.em.watch(Customer);
        await ctx.em.getDatabase().dropDatabase();
        await ctx.mod.close();
        expect(stream.closed).toBe(true);
    });
});

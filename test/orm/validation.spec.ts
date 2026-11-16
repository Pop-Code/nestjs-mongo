import 'reflect-metadata';

import { TestingModule } from '@nestjs/testing';
import { IsOptional, IsString } from 'class-validator';

import { Collection, Entity, EntityManager, IsUnique } from '../../src';
import { UniqueEmail } from './entities';
import { closeModule, createModule } from './setup';

@Collection('ormUniqueScoped')
class UniqueScoped extends Entity {
    @IsUnique({ keys: ['tenant'], sparse: true })
    @IsString()
    code: string;

    @IsOptional()
    @IsString()
    tenant?: string;
}

let ctx: { mod: TestingModule; em: EntityManager };
let em: EntityManager;

beforeAll(async () => {
    ctx = await createModule('orm-validation', [UniqueEmail, UniqueScoped]);
    em = ctx.em;
});

describe('validation messages', () => {
    it('should keep the message of each validation when they run at the same time', async () => {
        await em.insertMany(['a', 'b'].map((email) => Object.assign(new UniqueEmail(), { email })));
        const [a, b] = await Promise.all(
            ['a', 'b'].map(async (email) => await em.validate(Object.assign(new UniqueEmail(), { email })))
        );
        expect(a[0].constraints?.IsUnique).toContain('An item UniqueEmail with similar values already exists');
        expect(a[0].value).toBe('a');
        expect(b[0].value).toBe('b');
        expect(a[0].constraints?.IsUnique).toBe(b[0].constraints?.IsUnique);
    });

    it('should check the uniqueness with the keys, and the missing keys with sparse', async () => {
        await em.save(Object.assign(new UniqueScoped(), { code: 'c', tenant: 't1' }));
        expect(await em.validate(Object.assign(new UniqueScoped(), { code: 'c', tenant: 't2' }))).toHaveLength(0);
        expect(await em.validate(Object.assign(new UniqueScoped(), { code: 'c', tenant: 't1' }))).toHaveLength(1);
        await em.save(Object.assign(new UniqueScoped(), { code: 'd' }));
        expect(await em.validate(Object.assign(new UniqueScoped(), { code: 'd' }))).toHaveLength(1);
    });

    it('should ignore the entity itself', async () => {
        const saved = await em.save(Object.assign(new UniqueEmail(), { email: 'self' }));
        expect(await em.validate(saved)).toHaveLength(0);
    });
});

afterAll(async () => {
    await closeModule(ctx);
});

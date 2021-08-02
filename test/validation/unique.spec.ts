import 'reflect-metadata';

import { NestApplication } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ValidationError } from 'class-validator';

import { EntityManager, getEntityManagerToken, getIndexMetadatas, MongoModule } from '../../src';
import { DBTEST } from '../constants';
import { EntityUniqueTest } from './entity.unique';

let app: NestApplication;
let em: EntityManager;
const uri = DBTEST + '-unique';
beforeAll(async () => {
    const mod = await Test.createTestingModule({
        imports: [
            MongoModule.forRootAsync({
                useFactory: () => ({
                    uri,
                    exceptionFactory: (errors) => errors
                })
            }),
            MongoModule.forFeature({
                models: [EntityUniqueTest]
            })
        ]
    }).compile();
    app = mod.createNestApplication();
    await app.init();
    em = app.get(getEntityManagerToken());
});
describe('IsUnique', () => {
    it('should have an index defined in metadata', () => {
        const indexs = getIndexMetadatas(EntityUniqueTest);
        expect(indexs).toHaveLength(1);
        expect(indexs[0].property).toBe('foo');
        expect(indexs[0].description).toHaveProperty('unique', true);
    });
    it('should have an index created on collection', async () => {
        const indexes = await em.getCollection(EntityUniqueTest).indexes();
        expect(indexes).toHaveLength(2); // _id and foo
        expect(indexes[0].name).toBe('_id_');

        expect(indexes[1].name).toBe('foo_1');
        expect(indexes[1].key.foo).toBe(1);
        expect(indexes[1].unique).toBe(true);
    });
    it('should throw an error if a similar entity is saved', async () => {
        const uniqueEntity = new EntityUniqueTest();
        uniqueEntity.foo = 'bar';
        await em.save(uniqueEntity);

        const uniqueEntity2 = new EntityUniqueTest();
        uniqueEntity2.foo = 'bar';
        expect.assertions(5);
        try {
            await em.save(uniqueEntity2);
        } catch (e) {
            expect(e).toHaveLength(1);
            expect(e[0]).toBeInstanceOf(ValidationError);
            expect(e[0]).toHaveProperty('property', 'foo');
            expect(e[0]).toHaveProperty('value', uniqueEntity2.foo);
            expect(e[0].constraints).toHaveProperty(
                'IsUnique',
                'An item EntityUniqueTest with similar values already exists (foo)'
            );
        }
    });
});
afterAll(async () => {
    await em.getDatabase().dropDatabase();
    await app.close();
});

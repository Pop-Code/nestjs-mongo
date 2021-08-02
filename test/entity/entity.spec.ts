import { NestApplication } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ObjectId } from 'mongodb';

import { EntityManager, getEntityManagerToken, MongoModule } from '../../src';
import { DBTEST } from '../constants';
import { EntityTest } from './entity';

let app: NestApplication;
let em: EntityManager;
const uri = DBTEST + '-entity';

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
                models: [EntityTest]
            })
        ]
    }).compile();
    app = mod.createNestApplication();
    await app.init();
    em = app.get(getEntityManagerToken());
});

describe('Entity', () => {
    it('should save a new entity', async () => {
        const entity = new EntityTest();
        entity.foo = 'bar';
        entity.bar = 'foo';
        const response = await em.save<EntityTest>(entity);
        expect(response).toBeInstanceOf(EntityTest);
        expect(response._id).toBeInstanceOf(ObjectId);
        expect(response.foo).toEqual(entity.foo);
        expect(response.bar).toEqual(entity.bar);
    });
    it('should save and update an existing entity', async () => {
        const entity = new EntityTest();
        entity.foo = 'bar';
        entity.bar = 'foo';

        const response = await em.save<EntityTest>(entity);
        response.foo = 'UPDATED_VALUE';

        const updated = await em.save<EntityTest>(entity);
        expect(updated).toBeInstanceOf(EntityTest);
        expect(updated._id).toBeInstanceOf(ObjectId);
        expect(updated.foo).toEqual(entity.foo);
        expect(updated.bar).toEqual(entity.bar);
        expect(updated._id).toEqual(response._id);
    });
});

afterAll(async () => {
    await em.getDatabase().dropDatabase();
    await app.close();
});

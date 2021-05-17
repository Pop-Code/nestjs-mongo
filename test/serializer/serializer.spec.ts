import { NestApplication } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { validate } from 'class-validator';

import { getManagerToken, ObjectId } from '../../src/helpers';
import { MongoManager } from '../../src/manager';
import { MongoModule } from '../../src/module';
import { DBTEST } from '../constants';
import { EntitySerializerTest } from './entity.serializer';

let app: NestApplication;
let em: MongoManager;
const uri = DBTEST + '-serializer';

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
                models: [EntitySerializerTest]
            })
        ]
    }).compile();
    app = mod.createNestApplication();
    await app.init();
    em = app.get(getManagerToken());
});

describe('Entity', () => {
    describe('Serializer', () => {
        let entity: EntitySerializerTest;
        const parentId = new ObjectId();
        const child1Id = new ObjectId();
        const child2Id = new ObjectId();

        beforeAll(async () => {
            entity = new EntitySerializerTest();
            entity.foo = 'foo';
            entity.bar = 'bar';
            entity.parent = parentId;
            entity.children = [child1Id, child2Id];
            await em.save(entity);
        });
        it('should transform an entity to plain object (serialize)', async () => {
            const obj: any = entity.serialize();
            expect(obj._id).toBeDefined();
            expect(typeof obj._id).toEqual('string');
            expect(obj.foo).toBe('foo');
            expect(obj.bar).toBe('bar');
            expect(obj.parent).toBe(parentId.toHexString());
            expect(obj.children).toHaveLength(2);
            expect(obj.children[0]).toBe(child1Id.toHexString());
            expect(obj.children[1]).toBe(child2Id.toHexString());
        });
        it('should transform an entity to plain object (toJSON)', async () => {
            const obj: any = entity.toJSON();
            expect(obj._id).toBeDefined();
            expect(typeof obj._id).toEqual('string');
            expect(obj.foo).toBe('foo');
            expect(obj.bar).toBe('bar');
            expect(parentId.equals(obj.parent)).toBe(true);
            expect(obj.children).toHaveLength(2);
            expect(child1Id.equals(obj.children[0])).toBe(true);
            expect(child2Id.equals(obj.children[1])).toBe(true);
        });
        it('should transform a plain object to an entity using em', async () => {
            const obj: any = entity.serialize();
            const reEntity = em.fromPlain(EntitySerializerTest, obj);
            expect(reEntity).toBeInstanceOf(EntitySerializerTest);
            expect(reEntity.parent).toBeInstanceOf(ObjectId);
            expect(reEntity.children[0]).toBeInstanceOf(ObjectId);
            expect(reEntity.children[1]).toBeInstanceOf(ObjectId);
            const errors = await validate(reEntity);
            expect(errors).toHaveLength(0);
        });
        it('should transform a plain object to an entity using repository', async () => {
            const obj: any = entity.serialize();
            const reEntity = em.getRepository(EntitySerializerTest).fromPlain(obj);
            expect(reEntity).toBeInstanceOf(EntitySerializerTest);
            expect(reEntity.parent).toBeInstanceOf(ObjectId);
            expect(reEntity.children[0]).toBeInstanceOf(ObjectId);
            expect(reEntity.children[1]).toBeInstanceOf(ObjectId);
            const errors = await validate(reEntity);
            expect(errors).toHaveLength(0);
        });
    });
});

afterAll(async () => {
    await em.getDatabase().dropDatabase();
    await app.close();
});

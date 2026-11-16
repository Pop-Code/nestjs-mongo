import 'reflect-metadata';

import { Test, TestingModule } from '@nestjs/testing';
import { IsString } from 'class-validator';
import { ObjectId } from 'mongodb';

import {
    Collection,
    Entity,
    EntityManager,
    getEntityManagerToken,
    IsUnique,
    IsValidRelationship,
    MongoModule,
    Relationship
} from '../../src';
import { DBTEST } from '../constants';
import { EntityUniqueTest } from '../validation/entity.unique';

const NAME = 'secondary-validation';

@Collection('uniqueOnNamedConnection')
class UniqueOnNamedConnection extends Entity {
    @IsUnique()
    @IsString()
    bar: string;
}

@Collection('childOnNamedConnection')
class ChildOnNamedConnection extends Entity {
    @Relationship(() => UniqueOnNamedConnection)
    @IsValidRelationship()
    parentId: ObjectId;
}

let mod: TestingModule;
let defaultEm: EntityManager;
let namedEm: EntityManager;

beforeAll(async () => {
    mod = await Test.createTestingModule({
        imports: [
            MongoModule.forRootAsync({ useFactory: () => ({ uri: DBTEST + '-validation-default' }) }),
            MongoModule.forFeature({ models: [EntityUniqueTest] }),
            MongoModule.forRootAsync({
                connectionName: NAME,
                useFactory: () => ({ uri: DBTEST + '-validation-named' })
            }),
            MongoModule.forFeature({ connectionName: NAME, models: [UniqueOnNamedConnection, ChildOnNamedConnection] })
        ]
    }).compile();
    await mod.init();
    defaultEm = mod.get<EntityManager>(getEntityManagerToken());
    namedEm = mod.get<EntityManager>(getEntityManagerToken(NAME));
});

// The default exceptionFactory throws the ValidationError[]: a duplicate key error from the
// unique index would mean the validator queried the wrong connection.
describe('validation with multiple connections', () => {
    it('should check uniqueness on the default connection', async () => {
        await defaultEm.save(Object.assign(new EntityUniqueTest(), { foo: 'same' }));
        await expect(defaultEm.save(Object.assign(new EntityUniqueTest(), { foo: 'same' }))).rejects.toBeInstanceOf(
            Array
        );
    });
    it('should check uniqueness on a named connection', async () => {
        await namedEm.save(Object.assign(new UniqueOnNamedConnection(), { bar: 'same' }));
        await expect(
            namedEm.save(Object.assign(new UniqueOnNamedConnection(), { bar: 'same' }))
        ).rejects.toBeInstanceOf(Array);
    });
    it('should validate relationships on a named connection', async () => {
        const parent = await namedEm.save(Object.assign(new UniqueOnNamedConnection(), { bar: 'parent' }));
        await expect(
            namedEm.save(Object.assign(new ChildOnNamedConnection(), { parentId: parent._id }))
        ).resolves.toBeInstanceOf(ChildOnNamedConnection);
    });
});

afterAll(async () => {
    await defaultEm.getDatabase().dropDatabase();
    await namedEm.getDatabase().dropDatabase();
    await mod.close();
});

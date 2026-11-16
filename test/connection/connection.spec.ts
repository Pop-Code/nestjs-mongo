import 'reflect-metadata';

import { Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { EntityManager, EntityRepository, getEntityManagerToken, InjectEntityRepository, MongoModule } from '../../src';
import { DBTEST } from '../constants';
import { EntityTest } from '../entity/entity';

const NAME = 'secondary';

@Module({ imports: [MongoModule.forFeature({ connectionName: NAME, models: [EntityTest] })] })
class SecondaryFeature {
    constructor(@InjectEntityRepository(EntityTest, NAME) public repo: EntityRepository<EntityTest>) {}
}

let mod: TestingModule;

beforeAll(async () => {
    mod = await Test.createTestingModule({
        imports: [
            MongoModule.forRootAsync({ connectionName: NAME, useFactory: () => ({ uri: DBTEST + '-named' }) }),
            SecondaryFeature
        ]
    }).compile();
    await mod.init();
});

describe('named connection', () => {
    it('should inject the repository of a named connection', () => {
        expect(mod.get(SecondaryFeature).repo).toBeInstanceOf(EntityRepository);
    });
    it('should get the repository from the entity manager of a named connection', () => {
        const em = mod.get<EntityManager>(getEntityManagerToken(NAME));
        expect(em.getRepository(EntityTest)).toBe(mod.get(SecondaryFeature).repo);
    });
});

afterAll(async () => {
    await mod.get<EntityManager>(getEntityManagerToken(NAME)).getDatabase().dropDatabase();
    await mod.close();
});

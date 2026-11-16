import { Type } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { EntityInterface, EntityManager, getEntityManagerToken, MongoModule, MongoModuleOptions } from '../../src';
import { DBTEST } from '../constants';

/** Creates a testing module with a connection on its own database, and the models. */
export async function createModule(
    name: string,
    models: Array<Type<EntityInterface>>,
    options: Partial<MongoModuleOptions> = {}
): Promise<{ mod: TestingModule; em: EntityManager }> {
    const mod = await Test.createTestingModule({
        imports: [MongoModule.forRoot({ uri: `${DBTEST}-${name}`, ...options }), MongoModule.forFeature({ models })]
    }).compile();
    await mod.init();
    return { mod, em: mod.get<EntityManager>(getEntityManagerToken()) };
}

export async function closeModule({ mod, em }: { mod: TestingModule; em: EntityManager }) {
    await em.getDatabase().dropDatabase();
    await mod.close();
}

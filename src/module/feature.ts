import { DynamicModule, Global, Module } from '@nestjs/common';

import { EntityManager } from '../entity/manager';
import { EntityRepository } from '../entity/repository';
import { getEntityManagerToken, getEntityRepositoryToken, InjectEntityManager } from './injection';
import { MongoFeatureOptions } from './interfaces';

@Global()
@Module({})
export class MongoFeatureModule {
    constructor(@InjectEntityManager() private readonly em: EntityManager) {}

    // async onModuleInit() {
    //     console.log('INIT models', this.em.getModels());
    //     for (const [, model] of this.em.getModels()) {
    //         setRelationshipsCascadesMetadata(model, this.em);
    //         await this.em.createIndexes(model, this.em);
    //     }
    // }

    static forFeature(options: MongoFeatureOptions): DynamicModule {
        const { connectionName, models } = options;
        const providers: any = [];
        const managerToken = getEntityManagerToken(connectionName);
        for (const m of models) {
            const model = typeof m === 'object' ? m.model : m;
            const repoToken = getEntityRepositoryToken(model.name, connectionName);
            const RepoClass = typeof m === 'object' && m.repository !== undefined ? m.repository : EntityRepository;

            providers.push({
                provide: repoToken,
                inject: [managerToken],
                useFactory: async (em: EntityManager) => {
                    // register model on manager
                    await em.registerModel(model.name, model);
                    // register repository
                    const repo = new RepoClass(em, model);
                    em.registerRepository(repoToken, repo);
                    return repo;
                }
            });
        }
        return {
            module: MongoFeatureModule,
            providers,
            exports: providers
        };
    }
}

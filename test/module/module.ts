import { Module } from '@nestjs/common';

import { EntityRepository, InjectEntityRepository, MongoModule } from '../../src';
import { EntityTest } from '../entity/entity';
import { EntityRelationship } from '../relationship/entity.relationship';
import { EntityChildTest } from './child';

@Module({
    imports: [
        MongoModule.forFeature({
            models: [EntityTest, EntityChildTest, EntityRelationship]
        })
    ]
})
export class MongoDbModuleTest {
    constructor(@InjectEntityRepository(EntityTest) public repo: EntityRepository<EntityTest>) {}
}

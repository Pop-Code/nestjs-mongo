import { Module } from '@nestjs/common';
import { MongoRepository } from '../../repository';
import { EntityTest } from './entity';
import { MongoModule } from '../../module';
import { InjectRepository } from '../../decorators';
import { EntityChildTest } from './child';
import { EntityRelationship } from './entity.relationship';

@Module({
    imports: [
        MongoModule.forFeature({
            models: [EntityTest, EntityChildTest, EntityRelationship]
        })
    ]
})
export class MongoDbModuleTest {
    constructor(
        @InjectRepository(EntityTest)
        public repo: MongoRepository<EntityTest>
    ) {}
}

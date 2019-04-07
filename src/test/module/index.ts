/**
 * @module nestjs-mongo
 */

import { Module } from '@nestjs/common';
import { MongoRepository } from '../../repository';
import { EntityTest } from './entity';
import { MongoModule } from '../../module';
import { InjectRepository } from '../../decorators';

@Module({
    imports: [
        MongoModule.forFeature({
            models: [EntityTest]
        })
    ]
})
export class MongoDbModuleTest {
    constructor(
        @InjectRepository(EntityTest)
        public repo: MongoRepository<EntityTest>
    ) {}
}

import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';

import { DataLoaderMiddleware } from '../../src/dataloader/middleware';
import { InjectRepository } from '../../src/decorators';
import { MongoModule } from '../../src/module';
import { MongoRepository } from '../../src/repository';
import { EntityTest } from '../entity/entity';
import { EntityRelationship } from '../relationship/entity.relationship';
import { EntityChildTest } from './child';
import { TestController } from './controller';

@Module({
    imports: [
        MongoModule.forFeature({
            models: [EntityTest, EntityChildTest, EntityRelationship]
        })
    ],
    controllers: [TestController]
})
export class MongoDbModuleTest implements NestModule {
    constructor(
        @InjectRepository(EntityTest)
        public repo: MongoRepository<EntityTest>
    ) {}

    configure(consumer: MiddlewareConsumer) {
        consumer.apply(DataLoaderMiddleware).forRoutes('test');
    }
}

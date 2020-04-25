import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';

import { DataLooaderMiddleware } from '../../dataloader/middleware';
import { InjectRepository } from '../../decorators';
import { MongoModule } from '../../module';
import { MongoRepository } from '../../repository';
import { EntityChildTest } from './child';
import { TestController } from './controller';
import { EntityTest } from './entity';
import { EntityRelationship } from './entity.relationship';

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
        consumer.apply(DataLooaderMiddleware).forRoutes('test');
    }
}

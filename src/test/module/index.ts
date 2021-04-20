import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';

import { DataLoaderMiddleware } from '../../dataloader/middleware';
import { InjectRepository } from '../../decorators';
import { MongoModule } from '../../module';
import { MongoRepository } from '../../repository';
import { RelationshipEntityLevel1Test } from './cascade/level1';
import { RelationshipEntityLevel1WithChildrenTest } from './cascade/level1WithChildren';
import { RelationshipEntityLevel2Test } from './cascade/level2';
import { RelationshipEntityLevel3Test } from './cascade/level3';
import { EntityChildTest } from './child';
import { TestController } from './controller';
import { EntityTest } from './entity';
import {
    ChildDynamicRelationship,
    ParentDynamicRelationship1,
    ParentDynamicRelationship2,
} from './entity.dynamic.relationship';
import { EntityWithIndexTest } from './entity.index';
import { EntityNestedTest } from './entity.nested';
import { EntityRelationship } from './entity.relationship';
import { EntityUniqueRelationship } from './entity.relationship.unique';

@Module({
    imports: [
        MongoModule.forFeature({
            models: [
                EntityTest,
                EntityChildTest,
                EntityRelationship,
                EntityNestedTest,
                EntityWithIndexTest,
                RelationshipEntityLevel1Test,
                RelationshipEntityLevel2Test,
                RelationshipEntityLevel3Test,
                RelationshipEntityLevel1WithChildrenTest,
                EntityUniqueRelationship,
                ParentDynamicRelationship1,
                ParentDynamicRelationship2,
                ChildDynamicRelationship
            ]
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

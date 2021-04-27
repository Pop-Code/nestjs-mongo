import { IsString } from 'class-validator';
import { ObjectId } from 'mongodb';

import { Collection } from '../../src/decorators';
import { Entity } from '../../src/entity';
import { Index } from '../../src/indexes/decorators';
import { Relationship } from '../../src/relationship/decorators';
import { EntityChildTest } from './child';

export const TEST_COLLECTION_NAME = 'testuniquerelationship';

@Collection(TEST_COLLECTION_NAME)
export class EntityUniqueRelationship extends Entity {
    @IsString()
    @Index()
    bar: string;

    @Relationship({
        type: () => EntityChildTest
    })
    @Index({
        key: { child: 1, child2: 1 },
        unique: true,
        sparse: true
    })
    child?: ObjectId;

    @Relationship({
        type: () => EntityChildTest
    })
    child2?: ObjectId;
}

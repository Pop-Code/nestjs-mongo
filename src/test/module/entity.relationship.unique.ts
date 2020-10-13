import { IsString } from 'class-validator';
import { ObjectId } from 'mongodb';

import { Collection } from '../../decorators';
import { Entity } from '../../entity';
import { Relationship } from '../../relationship/decorators';
import { EntityChildTest } from './child';

export const TEST_COLLECTION_NAME = 'testuniquerelationship';

@Collection(TEST_COLLECTION_NAME)
export class EntityUniqueRelationship extends Entity {
    @IsString()
    foo: string;

    @Relationship({
        type: () => EntityChildTest,
        indexSpecification: {
            key: { child: 1 },
            unique: true,
            sparse: true
        }
    })
    child?: ObjectId;

    @Relationship({
        type: () => EntityChildTest,
        indexSpecification: {
            key: { child: 1, child2: 1 },
            unique: true,
            sparse: true
        }
    })
    child2?: ObjectId;
}

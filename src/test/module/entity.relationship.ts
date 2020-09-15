import { IsString } from 'class-validator';
import { ObjectId } from 'mongodb';

import { Collection } from '../../decorators';
import { Entity } from '../../entity';
import { Relationship } from '../../relationship/decorators';
import { EntityChildTest } from './child';

export const TEST_COLLECTION_NAME = 'testrelationship';

@Collection(TEST_COLLECTION_NAME)
export class EntityRelationship extends Entity {
    @IsString()
    foo: string;

    @Relationship({
        type: () => EntityChildTest
    })
    child?: ObjectId;

    @Relationship('EntityNestedTest')
    relationshipAsReference?: ObjectId;
}

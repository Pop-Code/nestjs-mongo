import { Entity } from '../../entity';
import { IsString } from 'class-validator';
import { Collection } from '../../decorators';
import { Relationship } from '../../relationship/decorators';
import { EntityChildTest } from './child';
import { ObjectId } from 'mongodb';

export const TEST_COLLECTION_NAME = 'testrelationship';

@Collection(TEST_COLLECTION_NAME)
export class EntityRelationship extends Entity {
    @IsString()
    foo: string;

    @Relationship(() => EntityChildTest)
    child?: ObjectId;

    @Relationship('EntityNestedTest')
    relationshipAsReference?: ObjectId;
}

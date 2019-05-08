import { Expose, Transform, Type } from 'class-transformer';
import { IsString } from 'class-validator';
import {
    Collection,
    ObjectIdTransformer,
    Relationship,
    TypeObjectId
} from '../../decorators';
import { Entity } from '../../entity';
import { ObjectId } from '../../helpers';
import { IsValidRelationship } from '../../validation/relationship/decorator';
import { EntityTest } from './entity';

export const TEST_CHILD_COLLECTION_NAME = 'testchildcollection';

@Collection('TEST_CHILD_COLLECTION_NAME')
export class EntityChildTest extends Entity {
    @IsString()
    foo: string;

    @TypeObjectId()
    @Relationship(EntityTest)
    @IsValidRelationship()
    parentId: ObjectId;
}

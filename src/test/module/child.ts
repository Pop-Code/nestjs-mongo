import { IsString, IsDefined } from 'class-validator';
import {
    Collection,
    Relationship,
    TypeObjectId,
    WithRelationship
} from '../../decorators';
import { Entity } from '../../entity';
import { ObjectId } from '../../helpers';
import { WithRelationshipInterface } from '../../interfaces/relationship';
import { IsValidRelationship } from '../../validation/relationship/decorator';
import { EntityTest } from './entity';

export const TEST_CHILD_COLLECTION_NAME = 'testchildcollection';

export interface EntityChildTest extends WithRelationshipInterface {}

@Collection('TEST_CHILD_COLLECTION_NAME')
@WithRelationship()
export class EntityChildTest extends Entity {
    @IsString()
    foo: string;

    @TypeObjectId()
    @Relationship(EntityTest)
    @IsValidRelationship()
    @IsDefined()
    parentId: ObjectId;
}

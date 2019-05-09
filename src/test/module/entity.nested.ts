import { IsString, IsDefined, ValidateNested } from 'class-validator';
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

export const TEST_CHILD_NESTED_COLLECTION_NAME = 'testnested';

export interface EntityNestedTest extends WithRelationshipInterface {}

@Collection(TEST_CHILD_NESTED_COLLECTION_NAME)
@WithRelationship()
export class EntityNestedTest extends Entity {
    @TypeObjectId()
    @Relationship(EntityTest)
    @IsValidRelationship()
    @IsDefined()
    parentId: ObjectId;
}

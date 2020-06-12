import { IsDefined } from 'class-validator';
import { Collection, TypeObjectId } from '../../decorators';
import { Entity } from '../../entity';
import { ObjectId } from '../../helpers';
import { Relationship } from '../../relationship/decorators';
import { EntityTest } from './entity';
export const TEST_CHILD_NESTED_COLLECTION_NAME = 'testnested';

@Collection(TEST_CHILD_NESTED_COLLECTION_NAME)
export class EntityNestedTest extends Entity {
    @TypeObjectId()
    @Relationship(() => EntityTest)
    @IsDefined()
    parentId: ObjectId;
}

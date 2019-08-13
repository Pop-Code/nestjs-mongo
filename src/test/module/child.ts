import {
    IsString,
    IsDefined,
    ValidateNested,
    IsOptional
} from 'class-validator';
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
import { EntityNestedTest } from './entity.nested';
import { Type } from 'class-transformer';
import { EntityRelationship } from './entity.relationship';

export const TEST_CHILD_COLLECTION_NAME = 'testchild';

export interface EntityChildTest extends WithRelationshipInterface {}

@Collection(TEST_CHILD_COLLECTION_NAME)
@WithRelationship()
export class EntityChildTest extends Entity {
    @IsString()
    foo: string;

    @TypeObjectId()
    @Relationship(EntityTest)
    @IsValidRelationship()
    @IsDefined()
    parentId: ObjectId;

    @ValidateNested()
    @IsOptional()
    @Type(() => EntityNestedTest)
    nestedEntity?: EntityNestedTest;

    @TypeObjectId(true)
    @IsOptional()
    @Relationship(EntityRelationship, true)
    @IsValidRelationship()
    entities?: ObjectId[];
}

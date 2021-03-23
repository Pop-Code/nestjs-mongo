import { Type } from 'class-transformer';
import { IsDefined, IsOptional, IsString, ValidateNested } from 'class-validator';

import { Collection } from '../../decorators';
import { Entity } from '../../entity';
import { ObjectId } from '../../helpers';
import { IsValidRelationship, Relationship } from '../../relationship/decorators';
import { EntityTest } from './entity';
import { EntityNestedTest } from './entity.nested';
import { EntityRelationship } from './entity.relationship';

@Collection('testchild')
export class EntityChildTest extends Entity {
    @IsString()
    foo: string;

    @Relationship({
        type: () => EntityTest,
        inversedBy: 'children'
    })
    @IsValidRelationship()
    @IsDefined()
    parentId: ObjectId;

    @ValidateNested()
    @IsOptional()
    @Type(() => EntityNestedTest)
    nestedEntity?: EntityNestedTest;

    @IsOptional()
    @Relationship({
        type: () => EntityRelationship,
        isArray: true
    })
    @IsValidRelationship()
    entities?: ObjectId[];
}

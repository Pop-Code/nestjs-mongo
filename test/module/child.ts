import { Type } from 'class-transformer';
import { IsDefined, IsOptional, IsString, ValidateNested } from 'class-validator';

import { Collection } from '../../src/decorators';
import { Entity } from '../../src/entity';
import { ObjectId } from '../../src/helpers';
import { IsValidRelationship, Relationship } from '../../src/relationship/decorators';
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

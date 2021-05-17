import { IsOptional, IsString } from 'class-validator';
import { ObjectId } from 'mongodb';

import { Collection } from '../../src/decorators';
import { Entity } from '../../src/entity';
import { IsValidRelationship, Relationship } from '../../src/relationship/decorators';
import { EntityTest } from '../entity/entity';

@Collection('entityRelationship')
export class EntityRelationship extends Entity {
    @IsString()
    property: string;

    @Relationship({
        type: () => EntityTest
    })
    @IsValidRelationship()
    @IsOptional()
    parent?: ObjectId;

    @Relationship('EntityTest')
    parentAsReference?: ObjectId;

    @Relationship({
        type: () => EntityTest,
        isArray: true
    })
    @IsValidRelationship()
    @IsOptional()
    children?: ObjectId[];

    @Relationship({
        type: () => EntityTest,
        isArray: true
    })
    childrenAsReference?: ObjectId[];
}

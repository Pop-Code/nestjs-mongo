import { IsOptional, IsString } from 'class-validator';
import { ObjectId } from 'mongodb';

import { Collection, Entity, IsValidRelationship, Relationship } from '../../src';
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

    __shouldBeExcluded?: string;
}

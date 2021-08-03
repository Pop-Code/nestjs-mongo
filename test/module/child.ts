import { IsString } from 'class-validator';
import { ObjectId } from 'mongodb';

import { Collection, Entity, IsValidRelationship, Relationship } from '../../src';
import { EntityTest } from '../entity/entity';

@Collection('testchild')
export class EntityChildTest extends Entity {
    @IsString()
    foo: string;

    @Relationship({
        type: () => EntityTest
    })
    @IsValidRelationship()
    parentId: ObjectId;
}

import { IsDefined } from 'class-validator';
import { ObjectId } from 'mongodb';

import { CascadeType, Collection, Entity, IsValidRelationship, Relationship } from '../../../src';
import { EntityTest } from '../../entity/entity';

@Collection('relationshipEntityLevel1WithChildrenTest')
export class RelationshipEntityLevel1WithChildrenTest extends Entity {
    @Relationship({
        type: () => EntityTest,
        cascade: [CascadeType.DELETE],
        isArray: true
    })
    @IsValidRelationship()
    @IsDefined()
    children: ObjectId[];
}

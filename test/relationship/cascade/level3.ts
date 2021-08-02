import { IsDefined } from 'class-validator';
import { ObjectId } from 'mongodb';

import { CascadeType, Collection, Entity, IsValidRelationship, Relationship } from '../../../src';
import { RelationshipEntityLevel2Test } from './level2';

@Collection('relationshipEntityLevel3Test')
export class RelationshipEntityLevel3Test extends Entity {
    @Relationship({
        type: () => RelationshipEntityLevel2Test,
        cascade: [CascadeType.DELETE]
    })
    @IsValidRelationship()
    @IsDefined()
    parentId: ObjectId;
}

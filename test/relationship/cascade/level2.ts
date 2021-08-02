import { IsDefined } from 'class-validator';
import { ObjectId } from 'mongodb';

import { CascadeType, Collection, Entity, IsValidRelationship, Relationship } from '../../../src';
import { RelationshipEntityLevel1Test } from './level1';

@Collection('relationshipEntityLevel2Test')
export class RelationshipEntityLevel2Test extends Entity {
    @Relationship({
        type: () => RelationshipEntityLevel1Test,
        cascade: [CascadeType.DELETE]
    })
    @IsValidRelationship()
    @IsDefined()
    parentId: ObjectId;
}

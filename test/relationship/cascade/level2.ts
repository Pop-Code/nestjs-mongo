import { IsDefined } from 'class-validator';

import { Collection } from '../../../src/decorators';
import { Entity } from '../../../src/entity';
import { ObjectId } from '../../../src/helpers';
import { IsValidRelationship, Relationship } from '../../../src/relationship/decorators';
import { CascadeType } from '../../../src/relationship/metadata';
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

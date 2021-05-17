import { IsDefined } from 'class-validator';

import { Collection } from '../../../src/decorators';
import { Entity } from '../../../src/entity';
import { ObjectId } from '../../../src/helpers';
import { IsValidRelationship, Relationship } from '../../../src/relationship/decorators';
import { CascadeType } from '../../../src/relationship/metadata';
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

import { IsDefined } from 'class-validator';

import { Collection } from '../../../decorators';
import { Entity } from '../../../entity';
import { ObjectId } from '../../../helpers';
import { IsValidRelationship, Relationship } from '../../../relationship/decorators';
import { CascadeType } from '../../../relationship/metadata';
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

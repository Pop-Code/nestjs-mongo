import { IsDefined } from 'class-validator';

import { Collection, TypeObjectId } from '../../../decorators';
import { Entity } from '../../../entity';
import { ObjectId } from '../../../helpers';
import { IsValidRelationship, Relationship } from '../../../relationship/decorators';
import { CascadeType } from '../../../relationship/metadata';
import { RelationshipEntityLevel2Test } from './level2';

@Collection('RelationshipEntityLevel3Test')
export class RelationshipEntityLevel3Test extends Entity {
    @TypeObjectId()
    @Relationship({
        type: () => RelationshipEntityLevel2Test,
        cascade: [CascadeType.DELETE]
    })
    @IsValidRelationship()
    @IsDefined()
    parentId: ObjectId;
}

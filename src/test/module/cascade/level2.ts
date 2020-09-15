import { IsDefined } from 'class-validator';

import { Collection, TypeObjectId } from '../../../decorators';
import { Entity } from '../../../entity';
import { ObjectId } from '../../../helpers';
import { IsValidRelationship, Relationship } from '../../../relationship/decorators';
import { CascadeType } from '../../../relationship/metadata';
import { RelationshipEntityLevel1Test } from './level1';

@Collection('RelationshipEntityLevel2Test')
export class RelationshipEntityLevel2Test extends Entity {
    @TypeObjectId()
    @Relationship({
        type: () => RelationshipEntityLevel1Test,
        cascade: [CascadeType.DELETE]
    })
    @IsValidRelationship()
    @IsDefined()
    parentId: ObjectId;
}

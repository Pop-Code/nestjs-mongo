import { IsDefined } from 'class-validator';

import { Collection, TypeObjectId } from '../../../decorators';
import { Entity } from '../../../entity';
import { ObjectId } from '../../../helpers';
import { IsValidRelationship, Relationship } from '../../../relationship/decorators';
import { CascadeType } from '../../../relationship/metadata';
import { EntityTest } from '../entity';

@Collection('relationshipEntityLevel1WithChildrenTest')
export class RelationshipEntityLevel1WithChildrenTest extends Entity {
    @TypeObjectId(true)
    @Relationship({
        type: () => EntityTest,
        cascade: [CascadeType.DELETE],
        isArray: true
    })
    @IsValidRelationship()
    @IsDefined()
    children: ObjectId[];
}

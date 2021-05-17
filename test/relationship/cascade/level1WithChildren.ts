import { IsDefined } from 'class-validator';

import { Collection } from '../../../src/decorators';
import { Entity } from '../../../src/entity';
import { ObjectId } from '../../../src/helpers';
import { IsValidRelationship, Relationship } from '../../../src/relationship/decorators';
import { CascadeType } from '../../../src/relationship/metadata';
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

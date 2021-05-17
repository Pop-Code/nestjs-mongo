import { IsDefined, IsString } from 'class-validator';

import { Collection } from '../../src/decorators';
import { Entity } from '../../src/entity';
import { ObjectId } from '../../src/helpers';
import { IsValidRelationship, Relationship } from '../../src/relationship/decorators';
import { EntityTest } from '../entity/entity';

@Collection('testchild')
export class EntityChildTest extends Entity {
    @IsString()
    foo: string;

    @Relationship({
        type: () => EntityTest,
        inversedBy: 'children'
    })
    @IsValidRelationship()
    @IsDefined()
    parentId: ObjectId;
}

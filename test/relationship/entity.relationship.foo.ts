import { IsString } from 'class-validator';
import { ObjectId } from 'mongodb';

import { Collection } from '../../src/decorators';
import { Relationship } from '../../src/relationship/decorators';
import { EntityTest } from '../entity/entity';
import { EntityRelationship } from './entity.relationship';

@Collection('entityRelationshipFoo')
export class EntityRelationshipFoo extends EntityRelationship {
    @IsString()
    foo: string;

    @Relationship({
        type: () => EntityTest
    })
    extendedFoo?: ObjectId;
}

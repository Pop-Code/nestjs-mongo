import { IsString } from 'class-validator';
import { ObjectId } from 'mongodb';

import { Collection } from '../../src/decorators';
import { Relationship } from '../../src/relationship/decorators';
import { EntityTest } from '../entity/entity';
import { EntityRelationship } from './entity.relationship';

@Collection('entityRelationshipBar')
export class EntityRelationshipBar extends EntityRelationship {
    @IsString()
    bar: string;

    @Relationship({
        type: () => EntityTest,
        isArray: true
    })
    extendedBar?: ObjectId[];
}

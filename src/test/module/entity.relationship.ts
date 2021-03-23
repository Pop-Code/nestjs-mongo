import { IsString } from 'class-validator';
import { ObjectId } from 'mongodb';

import { Collection } from '../../decorators';
import { Entity } from '../../entity';
import { Relationship } from '../../relationship/decorators';
import { EntityChildTest } from './child';

@Collection('testrelationship')
export class EntityRelationship extends Entity {
    @IsString()
    foo: string;

    @Relationship({
        type: () => EntityChildTest
    })
    child?: ObjectId;

    @Relationship('EntityNestedTest')
    relationshipAsReference?: ObjectId;
}

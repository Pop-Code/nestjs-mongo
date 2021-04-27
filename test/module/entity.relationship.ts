import { IsString } from 'class-validator';
import { ObjectId } from 'mongodb';

import { Collection } from '../../src/decorators';
import { Entity } from '../../src/entity';
import { Relationship } from '../../src/relationship/decorators';
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

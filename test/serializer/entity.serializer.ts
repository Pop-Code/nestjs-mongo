import { IsString } from 'class-validator';

import { ObjectId } from '../../src';
import { Collection, TypeObjectId } from '../../src/decorators';
import { Entity } from '../../src/entity';

@Collection('entitySerializerTest')
export class EntitySerializerTest extends Entity {
    @IsString()
    foo: string;

    @IsString()
    bar: string;

    @TypeObjectId()
    parent: ObjectId;

    @TypeObjectId(true)
    children: ObjectId[];
}

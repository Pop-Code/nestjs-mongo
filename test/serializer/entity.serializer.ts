import { IsString } from 'class-validator';
import { ObjectId } from 'mongodb';

import { Collection, Entity, TypeObjectId } from '../../src';

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

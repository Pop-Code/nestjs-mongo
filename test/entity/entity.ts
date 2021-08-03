import { IsString } from 'class-validator';

import { Collection, Entity } from '../../src';

@Collection('entityTest')
export class EntityTest extends Entity {
    @IsString()
    foo: string;

    @IsString()
    bar: string;
}

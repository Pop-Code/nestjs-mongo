import { IsString } from 'class-validator';

import { Collection } from '../../src/decorators';
import { Entity } from '../../src/entity';

@Collection('entityTest')
export class EntityTest extends Entity {
    @IsString()
    foo: string;

    @IsString()
    bar: string;
}

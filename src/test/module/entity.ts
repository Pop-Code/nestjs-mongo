/**
 * @module nestjs-mongo
 */

import { Entity } from '../../entity';
import { IsString } from 'class-validator';
import { Collection } from '../../decorators';

export const TEST_COLLECTION_NAME = 'testcollection';

@Collection(TEST_COLLECTION_NAME)
export class EntityTest extends Entity {
    @IsString()
    foo: string;

    @IsString()
    bar: string;
}

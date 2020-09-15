import { IsString } from 'class-validator';

import { Collection } from '../../decorators';
import { Entity } from '../../entity';

export const TEST_COLLECTION_NAME = 'test';

@Collection(TEST_COLLECTION_NAME)
export class EntityTest extends Entity {
    @IsString()
    foo: string;

    @IsString()
    bar: string;
}

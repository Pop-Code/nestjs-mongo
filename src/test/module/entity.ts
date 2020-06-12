import { Entity } from '../../entity';
import { IsString } from 'class-validator';
import { Collection } from '../../decorators';

export const TEST_COLLECTION_NAME = 'test';

@Collection(TEST_COLLECTION_NAME)
export class EntityTest extends Entity {
    @IsString()
    foo: string;

    @IsString()
    bar: string;
}

import { Entity } from '../../entity';
import { IsString } from 'class-validator';
import { Collection } from '../../decorators';
import { WithRelationshipInterface } from '../..';

export const TEST_COLLECTION_NAME = 'test';

export interface EntityTest extends WithRelationshipInterface {}

@Collection(TEST_COLLECTION_NAME)
export class EntityTest extends Entity {
    @IsString()
    foo: string;

    @IsString()
    bar: string;

    children: any;
}

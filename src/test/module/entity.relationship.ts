import { Entity } from '../../entity';
import { IsString } from 'class-validator';
import { Collection } from '../../decorators';

export const TEST_COLLECTION_NAME = 'testrelationship';

@Collection(TEST_COLLECTION_NAME)
export class EntityRelationship extends Entity {
    @IsString()
    foo: string;
}

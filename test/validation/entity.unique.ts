import { Collection } from '../../src';
import { Entity } from '../../src/entity/entity';
import { IsUnique } from '../../src/validation/unique/decorator';

@Collection('entityUniqueTest')
export class EntityUniqueTest extends Entity {
    @IsUnique()
    foo: string;
}

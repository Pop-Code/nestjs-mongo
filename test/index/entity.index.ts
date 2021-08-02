import { Collection, Index } from '../../src';
import { Entity } from '../../src/entity/entity';

@Collection('entityWithIndexTest')
export class EntityWithIndexTest extends Entity {
    @Index({ unique: true })
    foo: string;
}

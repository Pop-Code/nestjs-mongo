import { Collection } from '../../src/decorators';
import { Entity } from '../../src/entity';
import { Index } from '../../src/indexes/decorators';

@Collection('testwithindex')
export class EntityWithIndexTest extends Entity {
    @Index({
        unique: true
    })
    foo: string;
}

import { Collection } from '../../decorators';
import { Entity } from '../../entity';
import { Index } from '../../indexes/decorators';

@Collection('testwithindex')
export class EntityWithIndexTest extends Entity {
    @Index({
        unique: true
    })
    foo: string;
}

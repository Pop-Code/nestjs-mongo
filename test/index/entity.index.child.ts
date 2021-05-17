import { Collection } from '../../src/decorators';
import { Index } from '../../src/indexes/decorators';
import { EntityWithIndexTest } from './entity.index';

@Collection('entityWithIndexChildTest')
export class EntityWithIndexChildTest extends EntityWithIndexTest {
    @Index()
    bar: string;
}

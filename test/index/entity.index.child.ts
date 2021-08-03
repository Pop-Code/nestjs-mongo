import { Collection, Index } from '../../src';
import { EntityWithIndexTest } from './entity.index';

@Collection('entityWithIndexChildTest')
export class EntityWithIndexChildTest extends EntityWithIndexTest {
    @Index()
    bar: string;
}

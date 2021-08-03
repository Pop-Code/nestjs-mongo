import { Collection, Index, Relationship } from '../../src';
import { EntityWithIndexTest } from './entity.index';
import { EntityWithIndexChildTest } from './entity.index.child';

@Collection('entityWithIndexChild2Test')
export class EntityWithIndexChild2Test extends EntityWithIndexTest {
    @Index({
        unique: true
    })
    bar2: string;

    @Relationship({
        type: () => EntityWithIndexTest,
        index: {
            description: { key: { parent: 1 }, unique: true }
        }
    })
    parent: EntityWithIndexTest;

    @Relationship(() => EntityWithIndexChildTest)
    parent2: EntityWithIndexChildTest;
}

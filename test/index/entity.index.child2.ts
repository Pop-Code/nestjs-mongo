import { Relationship } from '../../src';
import { Collection } from '../../src/decorators';
import { Index } from '../../src/indexes/decorators';
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
        indexSpecification: {
            key: { parent: 1 },
            unique: true
        }
    })
    parent: EntityWithIndexTest;

    @Relationship(() => EntityWithIndexChildTest)
    parent2: EntityWithIndexChildTest;
}

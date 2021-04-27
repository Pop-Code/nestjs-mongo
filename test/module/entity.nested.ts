import { IsDefined } from 'class-validator';

import { Collection } from '../../src/decorators';
import { Entity } from '../../src/entity';
import { ObjectId } from '../../src/helpers';
import { Relationship } from '../../src/relationship/decorators';
import { EntityTest } from './entity';

@Collection('testnested')
export class EntityNestedTest extends Entity {
    @Relationship(() => EntityTest)
    @IsDefined()
    parentId: ObjectId;

    nestedPropTest = {
        toJSON() {
            return 'nested-prop-test';
        }
    };
}

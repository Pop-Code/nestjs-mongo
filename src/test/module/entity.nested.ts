import { IsDefined } from 'class-validator';

import { Collection } from '../../decorators';
import { Entity } from '../../entity';
import { ObjectId } from '../../helpers';
import { Relationship } from '../../relationship/decorators';
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

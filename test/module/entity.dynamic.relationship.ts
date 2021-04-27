import { IsIn, IsString } from 'class-validator';
import { ObjectId } from 'mongodb';

import { Collection } from '../../src/decorators';
import { Entity } from '../../src/entity';
import { Relationship } from '../../src/relationship/decorators';
import { CascadeType } from '../../src/relationship/metadata';

@Collection('testdynamicparentrelationship1')
export class ParentDynamicRelationship1 extends Entity {
    @IsString()
    foo: string;
}

@Collection('testdynamicparentrelationship2')
export class ParentDynamicRelationship2 extends Entity {
    @IsString()
    foo: string;

    @IsString()
    bar: string;
}

export enum DynamicRelationshipType {
    EntityParentDynamicRelationship1 = 'EntityParentDynamicRelationship1',
    EntityParentDynamicRelationship2 = 'EntityParentDynamicRelationship2'
}

const DynamicRelationshipDecorator = () => {
    return Relationship({
        cascade: [CascadeType.DELETE],
        possibleTypes: {
            property: 'parentType',
            values: Object.values(DynamicRelationshipType)
        },
        type: (obj: ChildDynamicRelationship) => {
            if (
                obj.parentType ===
                DynamicRelationshipType.EntityParentDynamicRelationship1
            ) {
                return ParentDynamicRelationship1;
            } else if (
                obj.parentType ===
                DynamicRelationshipType.EntityParentDynamicRelationship2
            ) {
                return ParentDynamicRelationship2;
            }
            // always return a default value
            return 'none' as any;
        }
    });
};

@Collection('testdynamicrelationship')
export class ChildDynamicRelationship extends Entity {
    @DynamicRelationshipDecorator()
    parentId?: ObjectId;

    @IsIn(Object.values(DynamicRelationshipType))
    parentType: DynamicRelationshipType;

    static getPossibleValuesForProperty() {
        return {
            parentType: Object.values(DynamicRelationshipType)
        };
    }
}

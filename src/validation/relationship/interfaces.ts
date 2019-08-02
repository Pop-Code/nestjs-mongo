import { ValidationOptions, ValidationArguments } from 'class-validator';
import { MongoManager } from '../../manager';

export type WithRelationshipTest = (
    object: any,
    relationship: any,
    em: MongoManager
) => Promise<string | true>;

export interface IsValidRelationshipOptions extends ValidationOptions {
    with?: (
        object: any,
        relationship: any,
        em: MongoManager
    ) => Promise<string | true>;
}

export interface IsValidRelationshipValidationArguments
    extends ValidationArguments {
    constraints: [WithRelationshipTest?];
}

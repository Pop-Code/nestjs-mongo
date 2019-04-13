import { registerDecorator, ValidationOptions } from 'class-validator';
import { IsValidRelationshipConstraint } from './constraint';
import { MongoManager } from '../../manager';

export interface IsValidRelationshipOptions extends ValidationOptions {
    with?: (
        object: any,
        relationship: any,
        em: MongoManager
    ) => Promise<string | true>;
}

export function IsValidRelationship(
    validationOptions?: IsValidRelationshipOptions
) {
    const constraints = [];
    if (validationOptions && validationOptions.with) {
        constraints.push(validationOptions.with);
    }

    return (object: any, propertyName: string) => {
        return registerDecorator({
            target: object.constructor,
            propertyName,
            options: validationOptions,
            constraints: [],
            validator: IsValidRelationshipConstraint
        });
    };
}

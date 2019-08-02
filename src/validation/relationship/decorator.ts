import { registerDecorator } from 'class-validator';
import { IsValidRelationshipConstraint } from './constraint';
import { IsValidRelationshipOptions } from './interfaces';

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
            constraints,
            validator: IsValidRelationshipConstraint
        });
    };
}

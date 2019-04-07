/**
 * @module nestjs-mongo
 */

import { registerDecorator, ValidationOptions } from 'class-validator';
import { IsUniqueConstraint } from './constraint';

export function IsUnique(
    validationOptions?: ValidationOptions & { keys?: string[] }
) {
    return (object: any, propertyName: string) => {
        registerDecorator({
            target: object.constructor,
            propertyName,
            options: validationOptions,
            constraints:
                validationOptions && validationOptions.keys
                    ? validationOptions.keys
                    : [],
            validator: IsUniqueConstraint
        });
    };
}

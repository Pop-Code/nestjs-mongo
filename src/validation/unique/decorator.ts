import { registerDecorator, ValidationOptions } from 'class-validator';
import { IsUniqueConstraint } from './constraint';
import _ from 'lodash';

export function IsUnique(
    validationOptions?: ValidationOptions & { keys?: string[] }
) {
    return (object: any, propertyName: string) => {
        const options = {
            keys: _.get(validationOptions, 'keys', [])
        };
        return registerDecorator({
            target: object.constructor,
            propertyName,
            options: validationOptions,
            constraints: [options],
            validator: IsUniqueConstraint
        });
    };
}

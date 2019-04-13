import { registerDecorator, ValidationOptions } from 'class-validator';
import { IsUniqueConstraint } from './constraint';
import { Entity } from '../../entity';

export function IsUnique(
    validationOptions?: ValidationOptions & { keys?: string[]; entity?: Entity }
) {
    return (object: any, propertyName: string) => {
        const keys =
            validationOptions && validationOptions.keys
                ? validationOptions.keys
                : [];
        const options = {
            keys,
            entity: validationOptions.entity
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

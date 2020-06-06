import { registerDecorator } from 'class-validator';
import { IsUniqueConstraint, IsUniqueOptions } from './constraint';
import { get } from 'lodash';

export function IsUnique(options?: IsUniqueOptions) {
    return (object: any, propertyName: string) => {
        return registerDecorator({
            validator: IsUniqueConstraint,
            target: object.constructor,
            propertyName,
            options: options,
            constraints: [
                {
                    keys: get(options, 'keys', []),
                    sparse: get(options, 'sparse', false)
                }
            ]
        });
    };
}

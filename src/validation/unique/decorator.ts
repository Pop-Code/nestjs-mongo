import { registerDecorator } from 'class-validator';
import { get } from 'lodash';

import { Index } from '../../indexes/decorators';
import { IsUniqueConstraint, IsUniqueOptions } from './constraint';

export function IsUnique(options?: IsUniqueOptions) {
    return (object: any, propertyName: string) => {
        if (options?.keys === undefined) {
            Index({
                key: {
                    [propertyName]: 1
                },
                unique: true,
                sparse: get(options, 'sparse', false)
            })(object, propertyName);
        }
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

import { registerDecorator } from 'class-validator';
import { get } from 'lodash';

import { Index } from '../../indexes/decorators';
import { IsUniqueConstraint, IsUniqueOptions } from './constraint';

export function IsUnique(options?: IsUniqueOptions) {
    return (target: any, propertyName: string) => {
        if (options?.noIndex !== true) {
            const optionsKeys = get(options, 'keys', []);
            const keys: { [key: string]: 1 | -1 } = { [propertyName]: 1 };
            for (const optionsKey of optionsKeys) {
                keys[optionsKey] = 1;
            }
            Index({
                key: keys,
                unique: true,
                sparse: options?.sparse ?? false
            })(target, propertyName);
        }

        return registerDecorator({
            validator: IsUniqueConstraint,
            target: target.constructor,
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

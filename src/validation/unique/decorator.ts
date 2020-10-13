import { registerDecorator } from 'class-validator';
import { get } from 'lodash';

import { Index } from '../../indexes/decorators';
import { IsUniqueConstraint, IsUniqueOptions } from './constraint';

export function IsUnique(options?: IsUniqueOptions) {
    return (object: any, propertyName: string) => {
        const noIndex = get(options, 'noIndex', false);
        if (!noIndex) {
            const optionsKeys = get(options, 'keys', []);
            const keys: { [key: string]: 1 | -1 } = {};
            for (const optionsKey of optionsKeys) {
                keys[optionsKey] = 1;
            }
            Index({
                key: keys,
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

import { registerDecorator } from 'class-validator';
import { IsUniqueConstraint, IsUniqueOptions } from './constraint';
import _ from 'lodash';

export function IsUnique(options?: IsUniqueOptions) {
    return (object: any, propertyName: string) => {
        return registerDecorator({
            validator: IsUniqueConstraint,
            target: object.constructor,
            propertyName,
            options: options,
            constraints: [
                {
                    keys: _.get(options, 'keys', []),
                    sparse: _.get(options, 'sparse', false)
                }
            ]
        });
    };
}

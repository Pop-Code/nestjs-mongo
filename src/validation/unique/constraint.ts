import {
    isEmpty,
    ValidationArguments,
    ValidationOptions,
    ValidatorConstraint,
    ValidatorConstraintInterface,
} from 'class-validator';

import { Entity } from '../../entity/entity';
import { EntityManager } from '../../entity/manager';
import { ensureSequentialTransaction } from '../../session/utils';

export type IsUniqueOptions = ValidationOptions & {
    keys?: string[];
    sparse?: boolean;
    noIndex?: boolean;
};

@ValidatorConstraint({ name: 'IsUnique', async: true })
export class IsUniqueConstraint implements ValidatorConstraintInterface {
    private em: EntityManager;
    private message: string;

    defaultMessage?(args?: ValidationArguments): string {
        return this.message;
    }

    async validate(value: any, args: ValidationArguments) {
        const object = args.object as Entity;
        const id = object._id;
        const query: any = {
            [args.property]: value
        };
        const options = args.constraints[0] as IsUniqueOptions;
        if (options.keys !== undefined && options.keys.length > 0) {
            for (const prop of options.keys) {
                if (isEmpty(object[prop])) {
                    if (options.sparse !== undefined && options.sparse) {
                        query[prop] = { $exists: false };
                    }
                    continue;
                }
                query[prop] = object[prop];
            }
        }
        if (!isEmpty(id)) {
            query._id = { $ne: id };
        }
        const type: any = object.constructor;
        const count = await ensureSequentialTransaction(
            this.em.getSessionLoaderService().getSessionContext(),
            async () => await this.em.count(type, query)
        );

        if (count > 0) {
            this.message = `An item ${args.object.constructor.name} with similar values already exists (${Object.keys(
                query
            ).join(', ')})`;
            return false;
        }
        return true;
    }

    setEm(em: EntityManager): IsUniqueConstraint {
        this.em = em;
        return this;
    }
}

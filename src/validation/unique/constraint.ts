import {
    ValidatorConstraint,
    ValidatorConstraintInterface,
    ValidationArguments,
    isEmpty,
    ValidationOptions
} from 'class-validator';
import { MongoManager } from '../../manager';
import { Entity } from '../../entity';

export type IsUniqueOptions = ValidationOptions & {
    keys?: string[];
    sparse?: boolean;
};

@ValidatorConstraint({ name: 'IsUnique', async: true })
export class IsUniqueConstraint implements ValidatorConstraintInterface {
    private em: MongoManager;
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
        if (options.keys.length > 0) {
            for (const prop of options.keys) {
                if (isEmpty(object[prop])) {
                    if (options.sparse) {
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
        const count = await this.em.count(type, query);
        if (count > 0) {
            this.message = `An item ${
                args.object.constructor.name
            } with similar values already exists (${Object.keys(query).join(
                ', '
            )})`;
            return false;
        }
        return true;
    }

    setEm(em: MongoManager): IsUniqueConstraint {
        this.em = em;
        return this;
    }
}

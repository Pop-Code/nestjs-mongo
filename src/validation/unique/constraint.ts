import {
    ValidatorConstraint,
    ValidatorConstraintInterface,
    ValidationArguments
} from 'class-validator';
import { MongoManager } from '../../manager';
import { Entity } from '../../entity';

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
        const options = args.constraints[0];
        if (options.keys.length) {
            for (const prop of options.keys) {
                const v = object[prop];
                if (!v) {
                    continue;
                }
                query[prop] = v;
            }
        }
        if (id) {
            query._id = { $ne: id };
        }
        const type: any = object.constructor;
        const count = await this.em.count(type, query);
        if (count > 0) {
            this.message = `A ${
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

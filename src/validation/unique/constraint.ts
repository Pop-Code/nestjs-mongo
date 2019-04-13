

import {
    ValidatorConstraint,
    ValidatorConstraintInterface,
    ValidationArguments
} from 'class-validator';
import { MongoManager } from '../../manager';

@ValidatorConstraint({ name: 'IsUnique', async: true })
export class IsUniqueConstraint implements ValidatorConstraintInterface {
    private em: MongoManager;
    private message: string;

    defaultMessage?(args?: ValidationArguments): string {
        return this.message;
    }

    async validate(value: any, args: ValidationArguments) {
        const id = (args.object as any)._id;
        const query: any = {
            [args.property]: value
        };
        if (args.constraints.length) {
            for (const p of args.constraints) {
                const v = (args.object as any)[p];
                if (!v) {
                    continue;
                }
                query[p] = (args.object as any)[p];
            }
        }
        if (id) {
            query._id = { $ne: id };
        }
        const count = await this.em.count(args.object, query);
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

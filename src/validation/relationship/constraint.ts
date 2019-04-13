import { MongoManager } from '../../manager';
import {
    ValidatorConstraint,
    ValidatorConstraintInterface,
    ValidationArguments
} from 'class-validator';
import _ from 'lodash';

@ValidatorConstraint({ name: 'IsValidRelationship', async: true })
export class IsValidRelationshipConstraint
    implements ValidatorConstraintInterface {
    private em: MongoManager;

    private message: string;

    defaultMessage?(args?: ValidationArguments): string {
        return this.message;
    }

    async validate(value: any, args: ValidationArguments) {
        try {
            const relationship = await this.em.getRelationship(
                args.object,
                args.property
            );

            if (!relationship) {
                this.message = `The ${args.property} ${
                    args.value
                } does not exist`;
                return false;
            }

            const withTest = _.first(args.constraints);
            if (withTest) {
                const message = await withTest.bind(args.object)(
                    relationship,
                    this.em
                );
                if (typeof message === 'string') {
                    this.message = message;
                    return false;
                }
            }

            return true;
        } catch (e) {
            throw e; // ?
        }
    }

    setEm(em: MongoManager): IsValidRelationshipConstraint {
        this.em = em;
        return this;
    }
}

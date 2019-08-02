import {
    ValidatorConstraint,
    ValidatorConstraintInterface
} from 'class-validator';
import _ from 'lodash';
import { MongoManager } from '../../manager';
import {
    IsValidRelationshipValidationArguments,
    WithRelationshipTest
} from './interfaces';

@ValidatorConstraint({ name: 'IsValidRelationship', async: true })
export class IsValidRelationshipConstraint
    implements ValidatorConstraintInterface {
    private em: MongoManager;

    private message: string;

    defaultMessage?(args?: IsValidRelationshipValidationArguments): string {
        return this.message;
    }

    async validate(value: any, args: IsValidRelationshipValidationArguments) {
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

            const withTestFunction = _.first(args.constraints);
            if (withTestFunction) {
                const withTest: WithRelationshipTest = withTestFunction.bind(
                    args.object
                );
                const message = await withTest(
                    args.object,
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

import {
    ValidatorConstraint,
    ValidatorConstraintInterface
} from 'class-validator';
import { first } from 'lodash';

import { ObjectId } from '../helpers';
import { MongoManager } from '../manager';
import {
    IsValidRelationshipValidationArguments,
    WithRelationshipTest
} from './decorators';
import { getRelationshipMetadata, RelationshipMetadata } from './metadata';

@ValidatorConstraint({ name: 'IsValidRelationship', async: true })
export class IsValidRelationshipConstraint
    implements ValidatorConstraintInterface {
    private em: MongoManager;

    private message: string;

    defaultMessage?(args?: IsValidRelationshipValidationArguments): string {
        return this.message;
    }

    async validate(
        value: ObjectId | ObjectId[],
        args: IsValidRelationshipValidationArguments
    ) {
        const obj = args.object as any;
        try {
            const relationMetadata: RelationshipMetadata<any> = getRelationshipMetadata(
                obj,
                args.property
            );
            let relationship: any;

            if (relationMetadata.isArray) {
                if (!Array.isArray(value)) {
                    throw new Error(`The ${args.property} must be an array`);
                }
                const errors: Error[] = [];
                relationship = [];
                for (const [index, _id] of value.entries()) {
                    const innerR = await this.em.findOne<any>(
                        relationMetadata.type,
                        {
                            _id
                        }
                    );
                    if (innerR === undefined) {
                        errors.push(
                            new Error(
                                `The property ${
                                    args.property
                                } contains an invalid relationship ${_id.toHexString()} at index ${index}`
                            )
                        );
                        relationship.push(null);
                        continue;
                    }
                    relationship.push(innerR);
                }
                if (errors.length > 0) {
                    throw new Error(errors.map((e) => e.message).join(', '));
                }
            } else {
                if (Array.isArray(value)) {
                    throw new Error(
                        `The ${args.property} must not be an array`
                    );
                }
                relationship = await this.em.getRelationship(
                    args.object as any,
                    args.property
                );
                if (relationship === undefined) {
                    throw new Error(
                        `The property ${
                            args.property
                        } contains an invalid relationship ${value.toHexString()}`
                    );
                }
            }

            const withTestFunction = first(args.constraints);
            if (typeof withTestFunction === 'function') {
                const withTest: WithRelationshipTest = withTestFunction.bind(
                    args.object
                );
                const message = await withTest(
                    args.object,
                    relationship,
                    this.em
                );
                if (typeof message === 'string') {
                    throw new Error(message);
                }
            }
            return true;
        } catch (e) {
            this.message = e.message;
            return false;
        }
    }

    setEm(em: MongoManager): IsValidRelationshipConstraint {
        this.em = em;
        return this;
    }
}

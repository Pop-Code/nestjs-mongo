import { ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
import { first, isEmpty } from 'lodash';
import { ObjectId } from 'mongodb';

import { EntityManager } from '../entity/manager';
import { ensureSequentialTransaction } from '../session/utils';
import { IsValidRelationshipValidationArguments, WithRelationshipTest } from './decorators';
import { RelationshipMetadata } from './interfaces';
import { getRelationshipMetadata } from './metadata';

@ValidatorConstraint({ name: 'IsValidRelationship', async: true })
export class IsValidRelationshipConstraint implements ValidatorConstraintInterface {
    private em: EntityManager;
    private message: string;

    defaultMessage?(args?: IsValidRelationshipValidationArguments): string {
        return this.message;
    }

    async validate(value: ObjectId | ObjectId[], args: IsValidRelationshipValidationArguments) {
        const entity = args.object as any;
        const ctx = this.em.getSessionLoaderService().getSessionContext();

        try {
            const relationMetadata: RelationshipMetadata<any> = getRelationshipMetadata(
                entity.constructor,
                args.property,
                this.em,
                entity
            );
            let relationship: any;

            if (relationMetadata.isArray !== undefined && relationMetadata.isArray) {
                if (!Array.isArray(value)) {
                    throw new Error(`The ${args.property} must be an array`);
                }
                const errors: Error[] = [];
                relationship = [];
                for (const [index, _id] of value.entries()) {
                    const innerR = await ensureSequentialTransaction(
                        ctx,
                        async () =>
                            await this.em.findOne<any>(relationMetadata.type, {
                                _id
                            })
                    );
                    if (isEmpty(innerR)) {
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
                    throw new Error(`The ${args.property} must not be an array`);
                }
                // console.log('Validate', entity, args);
                relationship = await ensureSequentialTransaction(
                    ctx,
                    async () => await this.em.getRelationship(entity, args.property)
                );

                if (isEmpty(relationship)) {
                    throw new Error(`The property ${args.property} contains an invalid relationship`);
                }
            }

            const withTestFunction = first(args.constraints);
            if (typeof withTestFunction === 'function') {
                const withTest: WithRelationshipTest = withTestFunction.bind(args.object);
                const message = await withTest(args.object, relationship, this.em, ctx?.session);
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

    setEm(em: EntityManager): IsValidRelationshipConstraint {
        this.em = em;
        return this;
    }
}

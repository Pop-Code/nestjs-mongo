import { ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
import { first, isEmpty } from 'lodash';
import { ObjectId } from 'mongodb';

import { EntityManager, getModelEntityManager } from '../entity/manager';
import { ensureSequentialTransaction } from '../session/utils';
import { getValidationMessage, setValidationMessage } from '../validation/messages';
import { IsValidRelationshipValidationArguments, WithRelationshipTest } from './decorators';
import { RelationshipMetadata } from './interfaces';
import { getRelationshipMetadata } from './metadata';

@ValidatorConstraint({ name: 'IsValidRelationship', async: true })
export class IsValidRelationshipConstraint implements ValidatorConstraintInterface {
    private em: EntityManager;

    defaultMessage(args?: ValidationArguments): string {
        return getValidationMessage(args, 'The property contains an invalid relationship');
    }

    async validate(value: ObjectId | ObjectId[], args: IsValidRelationshipValidationArguments) {
        const entity = args.object as any;
        const em = getModelEntityManager(entity) ?? this.em;
        const ctx = em.getSessionLoaderService().getSessionContext();

        try {
            const relationMetadata: RelationshipMetadata<any> = getRelationshipMetadata(
                entity.constructor,
                args.property,
                em,
                entity
            );
            let relationship: any;

            if (relationMetadata?.isArray === true) {
                if (!Array.isArray(value)) {
                    throw new Error(`The ${args.property} must be an array`);
                }
                // one query for all the ids
                const found = await ensureSequentialTransaction(
                    ctx,
                    async () => await em.findByIds(relationMetadata.type, value)
                );
                const byId = new Map(found.map((r) => [r._id.toHexString(), r]));
                const errors: string[] = [];
                relationship = value.map((_id, index) => {
                    const related = byId.get(new ObjectId(_id).toHexString());
                    if (related === undefined) {
                        errors.push(
                            `The property ${args.property} contains an invalid relationship ${String(_id)} at index ${index}`
                        );
                        return null;
                    }
                    return related;
                });
                if (errors.length > 0) {
                    throw new Error(errors.join(', '));
                }
            } else {
                if (Array.isArray(value)) {
                    throw new Error(`The ${args.property} must not be an array`);
                }
                relationship = await ensureSequentialTransaction(
                    ctx,
                    async () => await em.getRelationship(entity, args.property)
                );

                if (isEmpty(relationship)) {
                    throw new Error(`The property ${args.property} contains an invalid relationship`);
                }
            }

            const withTestFunction = first(args.constraints);
            if (typeof withTestFunction === 'function') {
                const withTest: WithRelationshipTest = withTestFunction.bind(args.object);
                const message = await withTest(args.object, relationship, em, ctx?.session);
                if (typeof message === 'string') {
                    throw new Error(message);
                }
            }
            return true;
        } catch (e) {
            setValidationMessage(args, e.message);
            return false;
        }
    }

    setEm(em: EntityManager): IsValidRelationshipConstraint {
        this.em = em;
        return this;
    }
}

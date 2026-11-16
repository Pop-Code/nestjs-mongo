import { applyDecorators } from '@nestjs/common';
import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';
import Debug from 'debug';
import { ClientSession } from 'mongodb';

import { DEBUG } from '../constants';
import { EntityInterface } from '../entity/interfaces';
import { EntityManager } from '../entity/manager';
import { IndexMetadata, setIndexMetadata } from '../indexs/metadata';
import { TypeObjectId } from '../transformer/objectId';
import { IsValidRelationshipConstraint } from './constraint';
import { RelationshipMetadataOptions, RelationshipTypeDescriptor } from './interfaces';
import { setRelationshipMetadata } from './metadata';

export interface IsValidRelationshipOptions extends ValidationOptions {
    with?: WithRelationshipTest;
}
export type WithRelationshipTest = (
    object: any,
    relationship: any,
    em: EntityManager,
    session?: ClientSession
) => Promise<string | true>;

export interface IsValidRelationshipValidationArguments extends ValidationArguments {
    constraints: [WithRelationshipTest?];
}

/**
 * Validate that a {@link Relationship} property references existing entities.
 *
 * @param validationOptions class-validator options, plus `with`: an extra async test that receives the
 * loaded relationship and returns `true` or an error message.
 */
export function IsValidRelationship(validationOptions?: IsValidRelationshipOptions) {
    const constraints: WithRelationshipTest[] = [];
    if (validationOptions !== undefined && typeof validationOptions.with === 'function') {
        constraints.push(validationOptions.with);
    }

    return (object: any, propertyName: string) => {
        return registerDecorator({
            target: object.constructor,
            propertyName,
            options: validationOptions,
            constraints,
            validator: IsValidRelationshipConstraint
        });
    };
}

/**
 * Declare a property as a reference (an `ObjectId`, or an array of `ObjectId` with `isArray: true`)
 * to another model.
 *
 * It also transforms the value to/from `ObjectId` and creates an index on the property.
 *
 * @param options The target model as a function (`() => User`), a model name (`'User'`), or the full
 * options: `type`, `isArray`, `cascade`, `index`, `possibleTypes`.
 *
 * @example
 * ```ts
 * @Relationship(() => User)
 * @IsValidRelationship()
 * authorId: ObjectId;
 * ```
 */
export function Relationship<R extends EntityInterface = any>(
    options: RelationshipMetadataOptions<R> | RelationshipTypeDescriptor<R> | string
) {
    const debug = Debug(DEBUG + ':Relationship');

    const typeObjectIdDecorator = TypeObjectId(typeof options === 'object' ? options.isArray : false);

    const relationshipDecorator = (target: any, property: string) => {
        debug('Register relationship metadata %o on %s', options, target);
        const indexMetadata: IndexMetadata = {
            property,
            description: {
                name: `${target.constructor.name as string}_${property}_relationship`,
                key: { [property]: 1 }
            }
        };
        if (typeof options === 'function' || typeof options === 'string') {
            setRelationshipMetadata<R>(target, property, {
                type: options
            });
            setIndexMetadata(target, indexMetadata);
        } else {
            setRelationshipMetadata<R>(target, property, options);
            if (options.index !== undefined) {
                if (options.index.description !== undefined) {
                    indexMetadata.description = { ...indexMetadata.description, ...options.index.description };
                }
            }
            setIndexMetadata(target, indexMetadata);
        }
    };

    return applyDecorators(typeObjectIdDecorator, relationshipDecorator);
}

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

export type WithValidRelationship = (object: any, relationship: any, em: EntityManager) => Promise<string | true>;

export interface IsValidRelationshipOptions extends ValidationOptions {
    with?: WithValidRelationship;
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

export function IsValidRelationship(validationOptions?: IsValidRelationshipOptions) {
    const constraints: WithValidRelationship[] = [];
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

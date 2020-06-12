import {
    registerDecorator,
    ValidationArguments,
    ValidationOptions
} from 'class-validator';
import Debug from 'debug';
import { DEBUG } from '../constants';
import { EntityInterface } from '../interfaces/entity';
import { MongoManager } from '../manager';
import { IsValidRelationshipConstraint } from './constraint';
import {
    RelationshipMetadataOptions,
    setRelationshipMetadata,
    RelationshipTypeDescriptor
} from './metadata';

export interface IsValidRelationshipOptions extends ValidationOptions {
    with?: (
        object: any,
        relationship: any,
        em: MongoManager
    ) => Promise<string | true>;
}
export type WithRelationshipTest = (
    object: any,
    relationship: any,
    em: MongoManager
) => Promise<string | true>;

export interface IsValidRelationshipValidationArguments
    extends ValidationArguments {
    constraints: [WithRelationshipTest?];
}

export function IsValidRelationship(
    validationOptions?: IsValidRelationshipOptions
) {
    const constraints = [];
    if (
        validationOptions !== undefined &&
        typeof validationOptions.with === 'function'
    ) {
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

export function Relationship<R extends EntityInterface = any, Model = any>(
    options:
        | RelationshipMetadataOptions<R>
        | RelationshipTypeDescriptor<R>
        | string
) {
    const debug = Debug(DEBUG + ':Relationship');
    return (target: Model, property: string) => {
        debug('Register relationship metadata %o', options);
        if (typeof options === 'function' || typeof options === 'string') {
            setRelationshipMetadata<R>(target, property, {
                type: options
            });
        } else {
            setRelationshipMetadata<R>(target, property, options);
        }
    };
}

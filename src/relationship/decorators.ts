import { applyDecorators } from '@nestjs/common';
import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';
import Debug from 'debug';
import { ClientSession, IndexSpecification } from 'mongodb';

import { DEBUG } from '../constants';
import { TypeObjectId } from '../decorators';
import { setIndexMetadata } from '../indexes/metadata';
import { EntityInterface } from '../interfaces/entity';
import { MongoManager } from '../manager';
import { IsValidRelationshipConstraint } from './constraint';
import { RelationshipMetadataOptions, RelationshipTypeDescriptor, setRelationshipMetadata } from './metadata';

export type WithValidRelationship = (object: any, relationship: any, em: MongoManager) => Promise<string | true>;

export interface IsValidRelationshipOptions extends ValidationOptions {
    with?: WithValidRelationship;
}
export type WithRelationshipTest = (
    object: any,
    relationship: any,
    em: MongoManager,
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

    const typeObjectIdDecorator = TypeObjectId(
        typeof options === 'function' && typeof options === 'string' ? false : (options as any).isArray
    );

    const relationshipDecorator = (target: any, property: string) => {
        debug('Register relationship metadata %o', options);
        const indexName = `${target.constructor.name as string}_${property}_relationship`;
        let index: Partial<IndexSpecification>;
        if (typeof options === 'function' || typeof options === 'string') {
            setRelationshipMetadata<R>(target, property, {
                type: options
            });
            index = {
                name: indexName,
                key: { [property]: 1 }
            };
        } else {
            setRelationshipMetadata<R>(target, property, options);
            index = {
                name: indexName,
                key: { [property]: 1 },
                ...options.indexSpecification
            };
        }
        setIndexMetadata(target, property, index);
    };

    return applyDecorators(typeObjectIdDecorator, relationshipDecorator);
}

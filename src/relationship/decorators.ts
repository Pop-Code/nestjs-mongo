import { ClassType } from 'class-transformer/ClassTransformer';
import {
    registerDecorator,
    ValidationArguments,
    ValidationOptions
} from 'class-validator';
import Debug from 'debug';
import { DEBUG } from '../constants';
import { isClass } from '../helpers';
import { EntityInterface } from '../interfaces/entity';
import { MongoManager } from '../manager';
import { IsValidRelationshipConstraint } from './constraint';
import { RelationshipMetadata, setRelationshipMetadata } from './metadata';

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
    if (validationOptions && validationOptions.with) {
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

export const Relationship = <
    Relationship extends EntityInterface = any,
    Model = any
>(
    options: RelationshipMetadata<Relationship, Model> | ClassType<Relationship>
) => {
    const debug = Debug(DEBUG + ':Relationship');

    return (target: Model, property: string) => {
        debug('Register relationship metadata %o', options);
        if (isClass(options)) {
            setRelationshipMetadata<Relationship, Model>(target, property, {
                type: options as ClassType<Relationship>,
                isArray: false
            });
        } else {
            setRelationshipMetadata<Relationship, Model>(
                target,
                property,
                options as RelationshipMetadata<Relationship, Model>
            );
        }
    };
};

export interface WithRelationshipInterface {
    getCachedRelationship<T = any>(prop: string): T;
    setCachedRelationship(prop: string, value: any): WithRelationshipInterface;
}

function getCachedRelationship<Relationship = any>(prop: string): Relationship {
    if (!this.__cachedRelationships) {
        return;
    }
    return this.__cachedRelationships.get(prop);
}
function setCachedRelationship(prop: string, value: any) {
    if (!this.__cachedRelationships) {
        Object.defineProperty(this, '__cachedRelationships', {
            writable: true,
            value: new Map(),
            enumerable: false,
            configurable: false
        });
    }
    this.__cachedRelationships.set(prop, value);
    return this;
}
export const WithRelationship = () => {
    return (target: any) => {
        target.prototype.getCachedRelationship = getCachedRelationship;
        target.prototype.setCachedRelationship = setCachedRelationship;
    };
};

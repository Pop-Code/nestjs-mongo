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
    options: RelationshipMetadata<R, Model> | ClassType<R>
) {
    const debug = Debug(DEBUG + ':Relationship');
    return (target: Model, property: string) => {
        debug('Register relationship metadata %o', options);
        if (isClass(options)) {
            setRelationshipMetadata<R, Model>(target, property, {
                type: options as ClassType<R>,
                isArray: false
            });
        } else {
            const opts = options as RelationshipMetadata<R, Model>;
            setRelationshipMetadata<R, Model>(target, property, opts);
        }
    };
}

/**
 * @deprecated since v0.9
 */
export interface WithRelationshipInterface {
    getCachedRelationship: <T = any>(prop: string) => T;
    setCachedRelationship: (
        prop: string,
        value: any
    ) => WithRelationshipInterface;
}

/**
 * @deprecated since v0.9
 */
export function getCachedRelationship<R = any>(prop: string): R {
    console.warn(
        'getCachedRelationship function is deprecated since 0.9 and will be remove in next major release'
    );
    if (this.__cachedRelationships === undefined) {
        return;
    }
    return this.__cachedRelationships.get(prop);
}

/**
 * @deprecated since v0.9
 */
export function setCachedRelationship(prop: string, value: any) {
    console.warn(
        'getCachedRelationship function is deprecated since 0.9 and will be remove in next major release'
    );
    if (this.__cachedRelationships === undefined) {
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

/**
 * @deprecated since v0.9
 */
export function WithRelationship() {
    console.warn(
        'WithRelationship decorator is deprecated since 0.9 and will be remove in next major release'
    );
    return (target: any) => {
        target.prototype.getCachedRelationship = getCachedRelationship;
        target.prototype.setCachedRelationship = setCachedRelationship;
    };
}

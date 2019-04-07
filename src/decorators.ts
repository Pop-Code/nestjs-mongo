/**
 * @module nestjs-mongo
 */

import { Inject } from '@nestjs/common';
import { DEFAULT_CONNECTION_NAME } from './constants';
import { getConnectionToken, getRepositoryToken, ObjectId } from './helpers';
import { TransformationType } from 'class-transformer';
import { ClassType } from 'class-transformer/ClassTransformer';

export const InjectMongoClient = (
    connectionName: string = DEFAULT_CONNECTION_NAME
) => Inject(getConnectionToken(connectionName));

export const InjectRepository = (
    entity: ClassType<any>,
    connectionName: string = DEFAULT_CONNECTION_NAME
) => Inject(getRepositoryToken(entity.name, connectionName));

export function ObjectIdTransformer(
    v: ObjectId,
    obj: any,
    type: TransformationType
) {
    if (!v) {
        return v;
    }

    switch (type) {
        case TransformationType.CLASS_TO_CLASS:
        case TransformationType.PLAIN_TO_CLASS:
            return ObjectId.isValid(v) ? new ObjectId(v) : v;
        case TransformationType.CLASS_TO_PLAIN:
            return v ? v.toHexString() : v;
        default:
            return v;
    }
}

export const Collection = (name: string) => (target: any) => {
    Reflect.defineMetadata('mongo:collectionName', name, target);
};

export const Relationship = (type?: any) => (target: any, property: string) => {
    Reflect.defineMetadata(
        'mongo:relationship',
        { type: type ? type : target.constructor },
        target,
        property
    );
};

export const WithRelationship = () => (target: any) => {
    if (!target.prototype.getCachedRelationship) {
        target.prototype.cachedRelationships = new Map();
        function getCachedRelationship(prop: string) {
            return this.cachedRelationships.get(prop);
        }
        target.prototype.getCachedRelationship = getCachedRelationship;

        function setCachedRelationship(prop: string, value: any) {
            this.cachedRelationships.set(prop, value);
            return this;
        }
        target.prototype.setCachedRelationship = setCachedRelationship;
    }
    return target;
};

import { Inject } from '@nestjs/common';
import {
    TransformationType,
    Type,
    Transform,
    classToPlain
} from 'class-transformer';
import { ClassType } from 'class-transformer/ClassTransformer';
import { DEFAULT_CONNECTION_NAME, DEBUG } from './constants';
import {
    getConnectionToken,
    getManagerToken,
    getRepositoryToken,
    ObjectId
} from './helpers';
import Debug from 'debug';
import { Allow } from 'class-validator';

export const InjectMongoClient = (
    connectionName: string = DEFAULT_CONNECTION_NAME
) => Inject(getConnectionToken(connectionName));

export const InjectManager = (
    connectionName: string = DEFAULT_CONNECTION_NAME
) => Inject(getManagerToken(connectionName));

export const InjectRepository = (
    entity: ClassType<any>,
    connectionName: string = DEFAULT_CONNECTION_NAME
) => Inject(getRepositoryToken(entity.name, connectionName));

export function ObjectIdTransformer(
    value: any,
    object: any,
    type: TransformationType
) {
    const debug = Debug(DEBUG + ':ObjectIdTransformer');
    let newValue: any;
    if (!value) {
        debug('No value to transform, skipping');
        return;
    }
    if (type === TransformationType.CLASS_TO_CLASS) {
        newValue = value;
    } else if (type === TransformationType.PLAIN_TO_CLASS) {
        newValue = ObjectId.isValid(value) ? new ObjectId(value) : undefined;
    } else if (type === TransformationType.CLASS_TO_PLAIN) {
        newValue = value instanceof ObjectId ? value.toHexString() : undefined;
    }

    debug(
        'After Transform (%s)%s => (%s)%s for %s',
        typeof value,
        value,
        typeof newValue,
        newValue,
        type
    );

    return newValue;
}

export const TypeObjectId = () => {
    const typefn = Type(() => ObjectId);
    const trfn = Transform(ObjectIdTransformer);
    const allowFw = Allow();
    return (target: any, property: any) => {
        typefn(target, property);
        trfn(target, property);
        allowFw(target, property);
    };
};

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

export const WithJSONSerialize = () => (target: any) => {
    if (!target.prototype.toJSON) {
        function toJSON() {
            return classToPlain(this);
        }
        target.prototype.toJSON = toJSON;
    }
    return target;
};

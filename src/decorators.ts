import { Inject } from '@nestjs/common';
import {
    classToPlain,
    Transform,
    TransformationType,
    Type
} from 'class-transformer';
import { ClassType } from 'class-transformer/ClassTransformer';
import { Allow } from 'class-validator';
import Debug from 'debug';
import { DEBUG, DEFAULT_CONNECTION_NAME } from './constants';
import {
    getConnectionToken,
    getManagerToken,
    getRepositoryToken,
    ObjectId
} from './helpers';

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

const objectIdFromString = (value: any) =>
    ObjectId.isValid(value) ? new ObjectId(value) : undefined;
const objectIdToString = (value: any) =>
    value instanceof ObjectId ? value.toHexString() : undefined;

export function ObjectIdTransformer(
    value: any,
    object: any,
    type: TransformationType,
    isArray?: boolean
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
        newValue = isArray
            ? value.map(objectIdFromString)
            : objectIdFromString(value);
    } else if (type === TransformationType.CLASS_TO_PLAIN) {
        newValue = isArray
            ? value.map(objectIdToString)
            : objectIdToString(value);
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

export const TypeObjectId = (isArray?: boolean) => {
    const typefn = Type(() => ObjectId);
    const trfn = Transform(
        (value: any, object: any, type: TransformationType) =>
            ObjectIdTransformer(value, object, type, isArray)
    );
    const allowfn = Allow();
    return (target: any, property: any) => {
        typefn(target, property);
        trfn(target, property);
        allowfn(target, property);
    };
};

export const Collection = (name: string) => (target: any) => {
    Reflect.defineMetadata('mongo:collectionName', name, target);
};

function toJSON() {
    return classToPlain(this);
}
export const WithJSONSerialize = () => (target: any) => {
    target.prototype.toJSON = toJSON;
};

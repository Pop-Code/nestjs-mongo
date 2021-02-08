import { applyDecorators, Inject } from '@nestjs/common';
import { RuntimeException } from '@nestjs/core/errors/exceptions/runtime.exception';
import { ClassConstructor, Expose, Transform, TransformationType, Type } from 'class-transformer';
import { Allow, isEmpty } from 'class-validator';
import slugify from 'slugify';

import { DEFAULT_CONNECTION_NAME } from './constants';
import { getConnectionToken, getManagerToken, getRepositoryToken, ObjectId } from './helpers';

export function InjectMongoClient(
    connectionName: string = DEFAULT_CONNECTION_NAME
) {
    return Inject(getConnectionToken(connectionName));
}

export function InjectManager(
    connectionName: string = DEFAULT_CONNECTION_NAME
) {
    return Inject(getManagerToken(connectionName));
}

export function InjectRepository(
    entity: ClassConstructor<any>,
    connectionName: string = DEFAULT_CONNECTION_NAME
) {
    return Inject(getRepositoryToken(entity.name, connectionName));
}

const objectIdFromString = (value: any) =>
    ObjectId.isValid(value) ? new ObjectId(value) : undefined;

const objectIdToString = (value: any) => {
    if (value instanceof ObjectId) {
        return value.toHexString();
    }
    if (typeof value === 'string') {
        return value;
    }
};

export function ObjectIdTransformer(
    value: any,
    object: any,
    type: TransformationType,
    isArray?: boolean
) {
    if (isArray === undefined) isArray = false;
    let newValue: any;
    if (isEmpty(value)) {
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

    return newValue;
}

export function TypeObjectId(isArray?: boolean) {
    const typefn = Type(() => ObjectId);
    const trfn = Transform((params) =>
        ObjectIdTransformer(params.value, params.obj, params.type, isArray)
    );
    const allowfn = Allow();
    return applyDecorators(typefn, trfn, allowfn);
}

export function Collection(name: string) {
    return (target: any) =>
        Reflect.defineMetadata('mongo:collectionName', name, target);
}

type KeysOfType<T, V> = { [K in keyof T]: T[K] extends V ? K : never }[keyof T];

interface ISlugifyOptions<T = any> {
    /* enforce "slugify-able" keys to reference only string values */
    keys?: Array<KeysOfType<T, string>>;
    generate?: (obj: T) => string;
    expose?: boolean;
    options?:
        | {
              replacement?: string;
              remove?: RegExp;
              lower?: boolean;
              strict?: boolean;
          }
        | string;
}

export function SlugDecorator<T>(
    target: any,
    key: string,
    config: ISlugifyOptions<T>
) {
    const seed = (obj: any) => {
        if (typeof config.generate === 'function') return config.generate(obj);

        if (config.keys?.length !== undefined && config.keys?.length > 0)
            return config.keys
                .filter(Boolean)
                .reduce((str, key) => `${str} ${obj[key] as string}`, '');

        throw new RuntimeException('Unable to slugify');
    };

    Transform(({ value, obj }) => value ?? slugify(seed(obj), config.options))(
        target,
        key
    );
}

export function Slugify<T = any>(config: ISlugifyOptions<T>) {
    return applyDecorators(
        ...[
            Type(() => String),
            (target: any, key: string) => SlugDecorator<T>(target, key, config),
            ...(config.expose !== undefined && config.expose ? [Expose()] : [])
        ]
    );
}

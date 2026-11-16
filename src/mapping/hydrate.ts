import { ClassConstructor, TransformationType } from 'class-transformer';
import { Document, ObjectId } from 'mongodb';

import {
    getClassTransformerExposedProperties,
    getClassTransformerTransforms,
    getClassTransformerType,
    isClassTransformerExcluded
} from './class-transformer';
import { ClassType, getFieldMetadata } from './metadata';

export const EXCLUDED_PREFIXES = ['__'];

const SKIP = Symbol('skip');

type Converter = (value: unknown, source: object) => unknown;

const converters = new WeakMap<ClassType, Map<string, Converter>>();
const exposedProperties = new WeakMap<ClassType, string[]>();

const isExcludedKey = (key: string, prefixes: string[] = EXCLUDED_PREFIXES) =>
    prefixes.some((prefix) => key.startsWith(prefix));

export const isPlainObject = (value: unknown): value is Record<string, unknown> => {
    if (value === null || typeof value !== 'object') return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
};

/** True for the BSON values (ObjectId, Decimal128, Binary, Long, ...), that are immutable. */
export const isBsonValue = (value: unknown): boolean =>
    value !== null && typeof value === 'object' && typeof Reflect.get(value, '_bsontype') === 'string';

/** Deep copy of the plain objects and arrays of a value, BSON values are kept as is. */
export function cloneValue(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(cloneValue);
    if (value instanceof Date) return new Date(value.getTime());
    if (isPlainObject(value)) {
        const copy: Record<string, unknown> = {};
        for (const key of Object.keys(value)) copy[key] = cloneValue(value[key]);
        return copy;
    }
    return value;
}

/** Converts a value to a type (a class, `ObjectId`, `Date`, `String`, `Number` or `Boolean`). */
export function convertTo(type: unknown, value: unknown): unknown {
    if (value === null || value === undefined || type === undefined) return cloneValue(value);
    if (Array.isArray(value)) return value.map((v) => convertTo(type, v));
    if (type === ObjectId) {
        if (value instanceof ObjectId) return value;
        if (typeof value === 'string') return new ObjectId(value);
        if (value instanceof Uint8Array) return new ObjectId(value);
        throw new TypeError(`Can not convert ${typeof value} to an ObjectId`);
    }
    if (type === Date) {
        if (value instanceof Date) return new Date(value.getTime());
        if (typeof value === 'string' || typeof value === 'number') return new Date(value);
        throw new TypeError(`Can not convert ${typeof value} to a Date`);
    }
    if (type === String) return String(value);
    if (type === Number) return Number(value);
    if (type === Boolean) return Boolean(value);
    if (isClassConstructor(type) && isPlainObject(value)) return hydrate(type, value);
    return cloneValue(value);
}

const isClassConstructor = (type: unknown): type is ClassConstructor<object> =>
    typeof type === 'function' && type.prototype !== undefined;

function createConverter(target: ClassType, key: string): Converter {
    const field = getFieldMetadata(target, key);
    if (field !== undefined) {
        return (value) => convertTo(field.type?.(), value);
    }

    if (isClassTransformerExcluded(target, key)) {
        return () => SKIP;
    }
    const transforms = getClassTransformerTransforms(target, key);
    const type = getClassTransformerType(target, key);
    const designType: unknown = Reflect.getMetadata('design:type', target.prototype, key);
    const baseType = type ?? (designType === Date || designType === ObjectId ? designType : undefined);

    if (transforms.length === 0) {
        return (value) => convertTo(baseType, value);
    }
    return (value, source) =>
        transforms.reduce(
            (v, transform) =>
                transform.transformFn({
                    value: v,
                    key,
                    obj: source,
                    type: TransformationType.PLAIN_TO_CLASS,
                    options: {}
                }),
            convertTo(baseType, value)
        );
}

function getConverter(target: ClassType, key: string): Converter {
    let map = converters.get(target);
    if (map === undefined) {
        map = new Map();
        converters.set(target, map);
    }
    let converter = map.get(key);
    if (converter === undefined) {
        converter = createConverter(target, key);
        map.set(key, converter);
    }
    return converter;
}

function getExposedProperties(target: ClassType): string[] {
    let properties = exposedProperties.get(target);
    if (properties === undefined) {
        properties = getClassTransformerExposedProperties(target);
        exposedProperties.set(target, properties);
    }
    return properties;
}

/**
 * Creates an instance of a class from a document or a plain object.
 *
 * The values are converted with the `@Field()`, `@Embedded()` and `@TypeObjectId()` decorators,
 * and with the class-transformer `@Type()`, `@Transform()`, `@Exclude()` and `@Expose()` decorators.
 * The properties that start with `__` are ignored.
 */
export function hydrate<Model extends object>(
    classType: ClassConstructor<Model>,
    data: Document | object,
    excludePrefixes: string[] = EXCLUDED_PREFIXES
): Model {
    const instance = new classType();
    const keys = new Set([...Object.keys(data), ...getExposedProperties(classType)]);
    for (const key of keys) {
        if (isExcludedKey(key, excludePrefixes)) continue;
        const value = getConverter(classType, key)(Reflect.get(data, key), data);
        if (value === SKIP) continue;
        if (value === undefined && !(key in data)) continue;
        Reflect.set(instance, key, value);
    }
    return instance;
}

function toDocumentValue(value: unknown): unknown {
    if (value === undefined || typeof value === 'function' || typeof value === 'symbol') return undefined;
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map((v) => toDocumentValue(v) ?? null);
    if (value instanceof Date) return new Date(value.getTime());
    if (
        isBsonValue(value) ||
        value instanceof RegExp ||
        value instanceof Map ||
        ArrayBuffer.isView(value) ||
        value instanceof ArrayBuffer
    ) {
        return value;
    }
    const doc: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
        if (isExcludedKey(key)) continue;
        const converted = toDocumentValue(v);
        if (converted !== undefined) doc[key] = converted;
    }
    return doc;
}

/**
 * Converts an entity to the document stored in MongoDB: the class instances become plain objects,
 * the `undefined` values, the functions and the properties that start with `__` are removed.
 * The document has the properties of the entity, so it keeps its type.
 */
export function toDocument<T extends object>(entity: T): T {
    return toDocumentValue(entity) as T;
}

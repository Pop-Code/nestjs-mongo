import { classToPlain } from 'class-transformer';

import { EXCLUDED_PREFIXES } from './transformers/utils';

/**
 * Transform a class instance to plain object (ObjectIds become string)
 */
export function serialize() {
    return classToPlain(this, { excludePrefixes: EXCLUDED_PREFIXES });
}

/**
 * Transform a class instance to json object (ObjectIds are not touched)
 */
export function toJSON() {
    const proto = Object.getPrototypeOf(this);

    const json = Object.entries(Object.getOwnPropertyDescriptors(proto))
        .filter(([_, { get }]) => typeof get === 'function')
        .reduce(
            (obj, [key]) => ({
                ...obj,
                [key]: this[key]
            }),
            { ...this }
        );

    return Object.keys(json)
        .filter((k) => !EXCLUDED_PREFIXES.some((prefix) => k.startsWith(prefix)))
        .reduce(
            (obj, key) => ({
                ...obj,
                [key]: typeof json[key]?.toJSON === 'function' ? json[key]?.toJSON() : json[key]
            }),
            {}
        );
}

/**
 * Extend a class to be serializable, add 2 methods serialize() and toJSON()
 */
export function Serializable() {
    return (target: any) => {
        target.prototype.serialize = serialize;
        target.prototype.toJSON = toJSON;
    };
}

export interface ISerializable {
    /**
     * Transform a class instance to plain object (ObjectIds become string)
     */
    serialize: typeof serialize;
    /**
     * Transform a class instance to json object (ObjectIds are not touched)
     */
    toJSON: typeof toJSON;
}

import { EXCLUDED_PREFIXES, toPlain } from '../transformer/utils';

export function serialize() {
    return toPlain(this);
}

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

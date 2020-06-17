import { classToPlain } from 'class-transformer';
import { EXCLUDED_PREFIXES } from './transformers/utils';

export interface ISerializable {
    serialize: () => object;
    toJSON: () => object;
}

export function serialize() {
    return classToPlain(this, { excludePrefixes: EXCLUDED_PREFIXES });
}

export function Serializable() {
    return (target: any) => {
        target.prototype.serialize = serialize;

        /* normalize toJSON to handle decorated property accessors */
        target.prototype.toJSON = function overrideToJSON() {
            const proto = Object.getPrototypeOf(this);

            const json = Object.entries(Object.getOwnPropertyDescriptors(proto))
                .filter(
                    ([_, descriptor]) => typeof descriptor.get === 'function'
                )
                .reduce(
                    (json, [key]) => ({
                        ...json,
                        [key]: this[key]
                    }),
                    { ...this }
                );

            return Object.keys(json)
                .filter(
                    (k) =>
                        !EXCLUDED_PREFIXES.some((prefix) =>
                            k.startsWith(prefix)
                        )
                )
                .reduce((obj, key) => ({ ...obj, [key]: json[key] }), {});
        };
    };
}

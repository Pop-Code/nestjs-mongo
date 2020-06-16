import { classToPlain } from 'class-transformer';

export interface ISerializable {
    serialize: () => object;
    toJSON: () => object;
}

export function serialize() {
    return classToPlain(this);
}

export function Serializable() {
    return (target: any) => {
        target.prototype.serialize = serialize;

        /* normalize toJSON to handle decorated property accessors */
        target.prototype.toJSON = function overrideToJSON() {
            const proto = Object.getPrototypeOf(this);

            return Object.entries(Object.getOwnPropertyDescriptors(proto))
                .filter(
                    ([_, descriptor]) => typeof descriptor.get === 'function'
                )
                .reduce(
                    (json, [key, descriptor]) => ({
                        ...json,
                        [key]: this[key]
                    }),
                    { ...this }
                );
        };
    };
}

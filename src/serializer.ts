import { classToPlain } from 'class-transformer';

export interface ISerializable {
    serialize: () => object;
}

export function serialize() {
    return classToPlain(this);
}

export function Serializable() {
    return (target: any) => {
        target.prototype.serialize = serialize;
    };
}

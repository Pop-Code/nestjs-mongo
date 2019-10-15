import { classToPlain } from 'class-transformer';

export interface ISerializable {
    serialize(): Object;
}

export function serialize() {
    return classToPlain(this);
}

export const Serializable = () => (target: any) => {
    target.prototype.serialize = serialize;
};

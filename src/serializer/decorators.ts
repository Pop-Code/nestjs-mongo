import { serialize, toJSON } from './serializer';

/**
 * Extend a class to be serializable, add 2 methods serialize() and toJSON()
 */
export function Serializable() {
    return (target: any) => {
        target.prototype.serialize = serialize;
        target.prototype.toJSON = toJSON;
    };
}

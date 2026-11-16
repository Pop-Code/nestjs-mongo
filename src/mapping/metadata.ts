/** Any class, abstract classes included. */
export type ClassType = abstract new (...args: never[]) => object;

/** A class and its parent classes, from the base class. */
export function getClassChain(target: ClassType): ClassType[] {
    const chain: ClassType[] = [];
    for (let t: unknown = target; typeof t === 'function' && t !== Function.prototype; t = Object.getPrototypeOf(t)) {
        chain.unshift(t as ClassType);
    }
    return chain;
}

export const FIELDS_METADATA_NAME = 'nestjs-mongo:fields';
export const VERSION_METADATA_NAME = 'nestjs-mongo:version';
export const DELETED_AT_METADATA_NAME = 'nestjs-mongo:deleted_at';

/** The mapping of a property of an entity (see {@link Field}). */
export interface FieldMetadata {
    /** The type of the value (a class, `ObjectId`, `Date`, `String`, `Number` or `Boolean`). */
    type?: () => any;
    /** True when the value is an array of `type`. */
    isArray?: boolean;
}

export function setFieldMetadata(target: object, property: string, metadata: FieldMetadata) {
    const fields: Record<string, FieldMetadata> = {
        ...(Reflect.getOwnMetadata(FIELDS_METADATA_NAME, target.constructor) ?? {})
    };
    fields[property] = { ...fields[property], ...metadata };
    Reflect.defineMetadata(FIELDS_METADATA_NAME, fields, target.constructor);
}

/** The field metadata of a class, including the metadata of its parent classes. */
export function getFieldsMetadata(target: ClassType): Record<string, FieldMetadata> {
    return getClassChain(target).reduce<Record<string, FieldMetadata>>(
        (fields, t) => ({ ...fields, ...(Reflect.getOwnMetadata(FIELDS_METADATA_NAME, t) ?? {}) }),
        {}
    );
}

export function getFieldMetadata(target: ClassType, property: string): FieldMetadata | undefined {
    return getFieldsMetadata(target)[property];
}

/** The name of the `@Version()` property of a model. */
export function getVersionProperty(model: ClassType): string | undefined {
    return Reflect.getMetadata(VERSION_METADATA_NAME, model);
}

/** The name of the `@DeletedAt()` property of a model. */
export function getDeletedAtProperty(model: ClassType): string | undefined {
    return Reflect.getMetadata(DELETED_AT_METADATA_NAME, model);
}

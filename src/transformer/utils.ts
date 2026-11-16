import { ClassConstructor, ClassTransformOptions, instanceToPlain, plainToInstance } from 'class-transformer';
import { unset } from 'lodash';

import { EntityInterface } from '../entity/interfaces';
import { EXCLUDED_PREFIXES, hydrate, isBsonValue } from '../mapping/hydrate';

export { EXCLUDED_PREFIXES };

export const toPlain = <T = any>(data: T) => instanceToPlain<T>(data, { excludePrefixes: EXCLUDED_PREFIXES });

/**
 * Creates an instance of a class from a plain object (see `hydrate()`).
 * With `options`, the instance is created by `plainToInstance()` of class-transformer.
 */
export const fromPlain = <Model extends EntityInterface>(
    classType: ClassConstructor<Model>,
    data: object,
    options?: ClassTransformOptions
): Model =>
    options === undefined
        ? hydrate(classType, data)
        : plainToInstance(classType, data, {
              excludePrefixes: EXCLUDED_PREFIXES,
              ...options
          });

const isMergeable = (value: any) =>
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    !(value instanceof Date) &&
    !isBsonValue(value) &&
    !ArrayBuffer.isView(value);

function deepMerge(target: any, source: any) {
    for (const key of Object.keys(source)) {
        const value = source[key];
        if (value === undefined) continue;
        if (isMergeable(value) && isMergeable(target[key])) {
            deepMerge(target[key], value);
        } else {
            target[key] = value;
        }
    }
    return target;
}

/**
 * Merges data into an entity: the sub objects are merged, the arrays and the other values replace the values
 * of the entity (`null` included), the `undefined` values are ignored.
 *
 * @param entity The entity to change
 * @param data The data to merge into the entity
 * @param excludePrefixes The properties of the entity that start with one of these prefixes are removed
 */
export const merge = <E extends object>(entity: E, data: Partial<E>, excludePrefixes?: string[]): E => {
    deepMerge(entity, data);

    for (const prop in entity) {
        if (excludePrefixes?.some((p) => prop.startsWith(p)) === true) {
            unset(entity, prop);
        }
    }

    return entity;
};

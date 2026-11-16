import { ClassConstructor, instanceToPlain, ClassTransformOptions, plainToInstance } from 'class-transformer';
import { mergeWith, unset } from 'lodash';

import { EntityInterface } from '../entity/interfaces';

export const EXCLUDED_PREFIXES = ['__'];

export const toPlain = <T = any>(data: T) => instanceToPlain<T>(data, { excludePrefixes: EXCLUDED_PREFIXES });

export const fromPlain = <Model extends EntityInterface>(
    classType: ClassConstructor<Model>,
    data: object,
    options?: ClassTransformOptions
) =>
    plainToInstance(classType, data, {
        excludePrefixes: EXCLUDED_PREFIXES,
        ...options
    });

/**
 * @param entity The model to hydrate
 * @param data The data to merge into the entity
 * @param excludePrefixes The prefixes to excludes (if the source contains key ith prefix)
 */
export const merge = <Model extends EntityInterface>(entity: Model, data: Model, excludePrefixes?: string[]) => {
    mergeWith(entity, data, (value: any, srcValue: any) => {
        return srcValue ?? value;
    });

    // clean any excluded property
    for (const prop in entity) {
        if (excludePrefixes?.some((p) => prop.startsWith(p)) === true) {
            unset(entity, prop);
        }
    }

    return entity;
};

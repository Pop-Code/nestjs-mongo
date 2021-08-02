import {
    ClassConstructor,
    classToClassFromExist,
    classToPlain,
    ClassTransformOptions,
    plainToClass,
} from 'class-transformer';

import { EntityInterface } from '../entity/interfaces';

export const EXCLUDED_PREFIXES = ['__'];

export const toPlain = <T = any>(data: T) => classToPlain<T>(data, { excludePrefixes: EXCLUDED_PREFIXES });

export const fromPlain = <Model extends EntityInterface>(
    classType: ClassConstructor<Model>,
    data: object,
    options?: ClassTransformOptions
) =>
    plainToClass(classType, data, {
        excludePrefixes: EXCLUDED_PREFIXES,
        ...options
    });

/**
 * @param entity The model to hydrate
 * @param data The data to merge into the entity
 */
export const merge = <Model extends EntityInterface>(entity: Model, data: Model, options?: ClassTransformOptions) =>
    classToClassFromExist(data, entity, {
        excludePrefixes: EXCLUDED_PREFIXES,
        ...options
    });

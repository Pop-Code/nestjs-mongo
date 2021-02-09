import { ClassConstructor, classToClassFromExist, ClassTransformOptions, plainToClass } from 'class-transformer';

import { EntityInterface } from '../interfaces/entity';

export const EXCLUDED_PREFIXES = ['__'];

export function fromPlain<Model extends EntityInterface>(
    classType: ClassConstructor<Model>,
    data: object,
    options?: ClassTransformOptions
): Model {
    return plainToClass(classType, data, {
        excludePrefixes: EXCLUDED_PREFIXES,
        ...options
    });
}

export function merge<Model extends EntityInterface>(
    entity: Model,
    data: any,
    options?: ClassTransformOptions
) {
    return classToClassFromExist(entity, data, {
        excludePrefixes: EXCLUDED_PREFIXES,
        ...options
    });
}

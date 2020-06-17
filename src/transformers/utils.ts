import { EntityInterface } from '../interfaces/entity';
import { ClassType } from 'class-transformer/ClassTransformer';
import {
    ClassTransformOptions,
    plainToClass,
    classToClassFromExist
} from 'class-transformer';

export const EXCLUDED_PREFIXES = ['__'];

export function fromPlain<Model extends EntityInterface>(
    classType: ClassType<Model>,
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
    return classToClassFromExist(data, entity, {
        excludePrefixes: EXCLUDED_PREFIXES,
        ...options
    });
}

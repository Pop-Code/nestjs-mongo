import { TransformationType } from 'class-transformer';
import type { MetadataStorage } from 'class-transformer/types/MetadataStorage';

import { ClassType } from './metadata';

// The metadata of the class-transformer decorators (@Type, @Transform, @Exclude, @Expose) used on the entities.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const storage: MetadataStorage = require('class-transformer/cjs/storage').defaultMetadataStorage;

/** The class of a `@Type(() => Class)` decorator of class-transformer. */
export function getClassTransformerType(target: ClassType, property: string): unknown {
    const metadata = storage.findTypeMetadata(target, property);
    return metadata?.typeFunction?.({ newObject: {}, object: {}, property });
}

/** The `@Transform()` functions of class-transformer that apply when a plain object is transformed to a class. */
export function getClassTransformerTransforms(target: ClassType, property: string) {
    return storage.findTransformMetadatas(target, property, TransformationType.PLAIN_TO_CLASS);
}

/** True when the property has an `@Exclude()` decorator of class-transformer that applies to the class. */
export function isClassTransformerExcluded(target: ClassType, property: string, toPlain = false): boolean {
    const metadata = storage.findExcludeMetadata(target, property);
    if (metadata === undefined) return false;
    return toPlain ? metadata.options?.toClassOnly !== true : metadata.options?.toPlainOnly !== true;
}

/** The properties with an `@Expose()` decorator of class-transformer that apply when a plain object is transformed to a class. */
export function getClassTransformerExposedProperties(target: ClassType): string[] {
    return storage.getExposedProperties(target, TransformationType.PLAIN_TO_CLASS);
}

import { applyDecorators } from '@nestjs/common';
import { Type } from 'class-transformer';
import { Allow, IsDate, IsInt, IsOptional } from 'class-validator';

import { DELETED_AT_METADATA_NAME, FieldMetadata, setFieldMetadata, VERSION_METADATA_NAME } from './metadata';

/**
 * Declares how a property is loaded from a document: the type of its value, or of the items of an array.
 *
 * ```ts
 * @Field(() => Date)
 * publishedAt: Date;
 *
 * @Field({ type: () => Address, isArray: true })
 * addresses: Address[];
 * ```
 *
 * The properties without `@Field()` are copied as they are (`ObjectId` and `Date` values are kept);
 * the `@Type()` decorator of class-transformer is also supported.
 */
export function Field(typeOrOptions?: (() => any) | FieldMetadata) {
    const metadata: FieldMetadata =
        typeof typeOrOptions === 'function' ? { type: typeOrOptions } : (typeOrOptions ?? {});
    const decorators: PropertyDecorator[] = [Allow()];
    if (metadata.type !== undefined) {
        // keep the class-transformer behavior of plainToInstance() and serialize()
        decorators.push(Type(metadata.type));
    }
    return applyDecorators(
        (target: object, property: string | symbol) => setFieldMetadata(target, String(property), metadata),
        ...decorators
    );
}

/**
 * Declares an embedded document (or an array of embedded documents with `isArray`):
 * the value is loaded as an instance of the class.
 * Add `@ValidateNested()` to validate it with the entity.
 */
export function Embedded(type: () => any, options: { isArray?: boolean } = {}) {
    return Field({ type, isArray: options.isArray });
}

/**
 * Enables the optimistic locking on a model: the property holds the version of the document,
 * set to 1 on insert and incremented on each update. `save()` throws an `OptimisticLockException`
 * when the document was changed since the entity was loaded.
 */
export function Version() {
    return applyDecorators(
        (target: object, property: string | symbol) => {
            Reflect.defineMetadata(VERSION_METADATA_NAME, String(property), target.constructor);
            setFieldMetadata(target, String(property), { type: () => Number });
        },
        IsInt(),
        IsOptional()
    );
}

/**
 * Enables the soft delete on a model: `deleteOne()` / `deleteMany()` set the date of the property
 * instead of removing the documents, and the queries ignore the deleted documents
 * (pass `withDeleted: true` to include them, `hard: true` to remove them).
 */
export function DeletedAt() {
    return applyDecorators(
        (target: object, property: string | symbol) => {
            Reflect.defineMetadata(DELETED_AT_METADATA_NAME, String(property), target.constructor);
            setFieldMetadata(target, String(property), { type: () => Date });
        },
        IsDate(),
        IsOptional()
    );
}

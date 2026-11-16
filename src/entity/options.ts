import { ClassConstructor } from 'class-transformer';
import { ValidatorOptions } from 'class-validator';
import {
    AggregateOptions,
    Document,
    ClientSessionOptions,
    CountDocumentsOptions,
    DeleteOptions,
    FindOneAndDeleteOptions,
    FindOneAndUpdateOptions,
    FindOptions,
    InsertOneOptions,
    ObjectId,
    Sort,
    TransactionOptions,
    UpdateOptions,
    WithId
} from 'mongodb';

import { EntityInterface } from './interfaces';

/** Options of the queries on a model with a `@DeletedAt()` property. */
export interface SoftDeleteOptions {
    /** Include the soft deleted documents. */
    withDeleted?: boolean;
}

export type FindEntityOptions = FindOptions & SoftDeleteOptions;

export type CountEntityOptions = CountDocumentsOptions & SoftDeleteOptions;

export type AggregateEntityOptions<T extends object = Document> = AggregateOptions &
    SoftDeleteOptions & {
        /** The class of the results, each result is loaded as an instance of this class. */
        as?: ClassConstructor<T>;
    };

/** Options of `save()`. */
export type SaveOptions = InsertOneOptions &
    UpdateOptions & {
        /** Do not validate the entity. */
        skipValidation?: boolean;
        /** The options of the class-validator validation. */
        validatorOptions?: ValidatorOptions;
        /** Do not run the lifecycle hooks (`@BeforeInsert()`, `@AfterSave()`, ...). */
        skipHooks?: boolean;
    };

/** Options of `deleteOne()` / `deleteMany()`. */
export type DeleteEntityOptions = DeleteOptions &
    SoftDeleteOptions & {
        /** Remove the documents of a model with a `@DeletedAt()` property instead of soft deleting them. */
        hard?: boolean;
        /** Do not run the lifecycle hooks (`@BeforeDelete()`, `@AfterDelete()`). */
        skipHooks?: boolean;
    };

export type FindOneAndDeleteEntityOptions = FindOneAndDeleteOptions & Omit<DeleteEntityOptions, keyof DeleteOptions>;

/** Options of `updateOne()` / `updateMany()` / `findOneAndUpdate()` / `upsert()`. */
export type UpdateEntityOptions = UpdateOptions &
    SoftDeleteOptions & {
        /** Set `updatedAt` (default `true`). */
        timestamps?: boolean;
    };

export type FindOneAndUpdateEntityOptions = FindOneAndUpdateOptions & Omit<UpdateEntityOptions, keyof UpdateOptions>;

/** Options of `withTransaction()` / `startSessionWithTransaction()`. */
export interface EntityTransactionOptions {
    transactionOptions?: TransactionOptions;
    sessionOptions?: ClientSessionOptions;
}

/** Options of `paginate()`. */
export interface PaginateOptions {
    skip?: number;
    limit?: number;
    sort?: Sort;
}

/** A page of results with the total count of the documents that match the filter. */
export interface PaginatedResult<T> {
    count: number;
    data: T[];
}

/** Options of `paginateByCursor()`. */
export interface CursorPaginateOptions {
    limit?: number;
    /** The `_id` of the last item of the previous page. */
    after?: ObjectId;
    /** Sort by `_id` ascending (1, default) or descending (-1). */
    direction?: 1 | -1;
}

/** A page of results, `next` is the `after` value of the next page (`undefined` on the last page). */
export interface CursorPaginatedResult<T> {
    data: T[];
    next?: ObjectId;
}

/** Options of `findWithRelationships()`. */
export interface FindWithRelationshipsOptions extends SoftDeleteOptions {
    sort?: Record<string, 1 | -1>;
    skip?: number;
    limit?: number;
}

/**
 * An entity and its relationships loaded by `findWithRelationships()`: an entity (or `undefined`) for a property,
 * a list of entities for an array property. The values are instances of the related models (use `instanceof`).
 */
export interface EntityWithRelationships<T, K extends string> {
    entity: T;
    relationships: Record<K, WithId<EntityInterface> | Array<WithId<EntityInterface>> | undefined>;
}

/** The keys of the options of the module, removed from the options passed to the driver. */
export const ENTITY_OPTION_KEYS = [
    'withDeleted',
    'hard',
    'skipValidation',
    'validatorOptions',
    'skipHooks',
    'timestamps',
    'as'
] as const;

export type EntityOptionKey = (typeof ENTITY_OPTION_KEYS)[number];

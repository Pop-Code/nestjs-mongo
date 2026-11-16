import { ClassConstructor, ClassTransformOptions } from 'class-transformer';
import { ValidatorOptions } from 'class-validator';
import {
    AnyBulkWriteOperation,
    BulkWriteOptions,
    ChangeStreamOptions,
    DistinctOptions,
    Document,
    EstimatedDocumentCountOptions,
    Filter,
    ObjectId,
    UpdateFilter,
    WithId
} from 'mongodb';

import { EntityInterface } from './interfaces';
import { EntityManager } from './manager';
import {
    AggregateEntityOptions,
    CountEntityOptions,
    CursorPaginateOptions,
    DeleteEntityOptions,
    FindEntityOptions,
    FindOneAndDeleteEntityOptions,
    FindOneAndUpdateEntityOptions,
    PaginateOptions,
    SaveOptions,
    SoftDeleteOptions,
    UpdateEntityOptions
} from './options';

/**
 * The repository of a model: the operations of the {@link EntityManager} for one model.
 * Extend it to add the queries of a model, and register it with `MongoModule.forFeature({ models: [{ model, repository }] })`.
 */
export class EntityRepository<Model extends EntityInterface> {
    constructor(
        protected readonly em: EntityManager,
        protected readonly classType: ClassConstructor<Model>
    ) {}

    getClassType() {
        return this.classType;
    }

    getEm() {
        return this.em;
    }

    getCollection() {
        return this.em.getCollection(this.getClassType());
    }

    async save(entity: Model | WithId<Model>, options?: SaveOptions): Promise<WithId<Model>> {
        return await this.em.save(entity, options);
    }

    async saveMany(entities: Array<Model | WithId<Model>>, options?: SaveOptions): Promise<Array<WithId<Model>>> {
        return await this.em.saveMany(entities, options);
    }

    async insertMany(entities: Model[], options?: SaveOptions & BulkWriteOptions): Promise<Array<WithId<Model>>> {
        return await this.em.insertMany(entities, options);
    }

    async patch(entity: Model | WithId<Model>, changes: Partial<Model>, options?: SaveOptions): Promise<WithId<Model>> {
        return await this.em.patch(entity, changes, options);
    }

    watch(pipes?: Document[], options: ChangeStreamOptions = {}) {
        return this.em.watch(this.classType, pipes, options);
    }

    async find(query: Filter<Model> = {}, options: FindEntityOptions = {}) {
        return await this.em.find(this.classType, query, options);
    }

    async findOne(query: Filter<Model>, options: FindEntityOptions = {}) {
        return await this.em.findOne(this.classType, query, options);
    }

    async findById(id: ObjectId | string, options: FindEntityOptions = {}) {
        return await this.em.findById(this.classType, id, options);
    }

    async findByIds(ids: Array<ObjectId | string>, options: FindEntityOptions = {}) {
        return await this.em.findByIds(this.classType, ids, options);
    }

    async findOneOrFail(query: Filter<Model>, options: FindEntityOptions = {}) {
        return await this.em.findOneOrFail(this.classType, query, options);
    }

    async count(query: Filter<Model> = {}, options: CountEntityOptions = {}) {
        return await this.em.count(this.classType, query, options);
    }

    async estimatedCount(options: EstimatedDocumentCountOptions = {}) {
        return await this.em.estimatedCount(this.classType, options);
    }

    async exists(query: Filter<Model>, options: FindEntityOptions = {}) {
        return await this.em.exists(this.classType, query, options);
    }

    async distinct(key: string, query: Filter<Model> = {}, options: DistinctOptions & SoftDeleteOptions = {}) {
        return await this.em.distinct(this.classType, key, query, options);
    }

    aggregate<T extends object = Document>(pipeline: Document[] = [], options: AggregateEntityOptions<T> = {}) {
        return this.em.aggregate<T, Model>(this.classType, pipeline, options);
    }

    async paginate(query: Filter<Model> = {}, paginateOptions: PaginateOptions = {}, options: FindEntityOptions = {}) {
        return await this.em.paginate(this.classType, query, paginateOptions, options);
    }

    async paginateByCursor(
        query: Filter<Model> = {},
        paginateOptions: CursorPaginateOptions = {},
        options: FindEntityOptions = {}
    ) {
        return await this.em.paginateByCursor(this.classType, query, paginateOptions, options);
    }

    async updateOne(query: Filter<Model>, update: UpdateFilter<Model> | Document[], options: UpdateEntityOptions = {}) {
        return await this.em.updateOne(this.classType, query, update, options);
    }

    async updateMany(
        query: Filter<Model>,
        update: UpdateFilter<Model> | Document[],
        options: UpdateEntityOptions = {}
    ) {
        return await this.em.updateMany(this.classType, query, update, options);
    }

    async findOneAndUpdate(
        query: Filter<Model>,
        update: UpdateFilter<Model> | Document[],
        options: FindOneAndUpdateEntityOptions = {}
    ) {
        return await this.em.findOneAndUpdate(this.classType, query, update, options);
    }

    async upsert(query: Filter<Model>, data: Partial<Model>, options: FindOneAndUpdateEntityOptions = {}) {
        return await this.em.upsert(this.classType, query, data, options);
    }

    async bulkWrite(operations: Array<AnyBulkWriteOperation<any>>, options: BulkWriteOptions = {}) {
        return await this.em.bulkWrite(this.classType, operations, options);
    }

    async deleteOne(query: Filter<Model>, options: DeleteEntityOptions = {}) {
        return await this.em.deleteOne(this.classType, query, options);
    }

    async deleteMany(query: Filter<Model>, options: DeleteEntityOptions = {}) {
        return await this.em.deleteMany(this.classType, query, options);
    }

    async findOneAndDelete(query: Filter<Model>, options: FindOneAndDeleteEntityOptions = {}) {
        return await this.em.findOneAndDelete(this.classType, query, options);
    }

    async restore(query: Filter<Model>, options: UpdateEntityOptions = {}) {
        return await this.em.restore(this.classType, query, options);
    }

    async getRelationship<E extends EntityInterface>(
        object: Model,
        property: Extract<keyof Model, string>,
        options: FindEntityOptions = {}
    ): Promise<WithId<E> | undefined> {
        return await this.em.getRelationship<E, Model>(object, property, options);
    }

    async getRelationships<E extends EntityInterface>(
        object: Model,
        property: Extract<keyof Model, string>,
        options: FindEntityOptions = {}
    ): Promise<Array<WithId<E>>> {
        return await this.em.getRelationships<E, Model>(object, property, options);
    }

    async populate<E extends EntityInterface>(
        entities: Model[],
        property: Extract<keyof Model, string>,
        options: FindEntityOptions = {}
    ) {
        return await this.em.populate<E, Model>(entities, property, options);
    }

    fromPlain(data: object, options?: ClassTransformOptions) {
        return this.em.fromPlain<Model>(this.classType, data, options);
    }

    merge<E extends Model | WithId<Model>>(entity: E, data: Partial<E>, excludePrefixes?: string[]): E {
        return this.em.merge(entity, data, excludePrefixes);
    }

    async validate(entity: Model, validatorOptions: ValidatorOptions = {}, throwError = false) {
        return await this.em.validate(entity, validatorOptions, throwError);
    }
}

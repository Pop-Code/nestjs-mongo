import { ClassConstructor, ClassTransformOptions } from 'class-transformer';
import { ValidatorOptions } from 'class-validator';
import { ChangeStreamOptions, CountDocumentsOptions, DeleteOptions, Document, Filter, FindOptions, WithId } from 'mongodb';

import { EntityInterface } from './interfaces';
import { EntityManager } from './manager';

export class EntityRepository<Model extends EntityInterface> {
    constructor(protected readonly em: EntityManager, protected readonly classType: ClassConstructor<Model>) {}

    getClassType() {
        return this.classType;
    }

    getEm() {
        return this.em;
    }

    async save(entity: Model | WithId<Model>, ...args: any[]): Promise<WithId<Model>> {
        return await this.em.save(entity, ...args);
    }

    watch(pipes?: Document[], options: ChangeStreamOptions = {}) {
        return this.em.watch(this.classType, pipes, options);
    }

    async find(query: Filter<Model>, options: FindOptions<Model> = {}) {
        return await this.em.find(this.classType, query, options);
    }

    async count(query: Filter<Model>, options: CountDocumentsOptions = {}) {
        return await this.em.count(this.classType, query, options);
    }

    async findOne(query: Filter<Model>, options: FindOptions = {}) {
        return await this.em.findOne(this.classType, query, options);
    }

    async deleteOne(query: Filter<Model>, options: DeleteOptions = {}) {
        return await this.em.deleteOne(this.classType, query, options);
    }

    async deleteMany(query: Filter<Model>, ...args: any) {
        return await this.em.deleteMany(this.classType, query, ...args);
    }

    async getRelationship<E extends EntityInterface>(
        object: Model,
        property: string,
        options: FindOptions = {}
    ): Promise<WithId<E> | undefined> {
        return await this.em.getRelationship<E>(object, property, options);
    }

    async getRelationships<E extends EntityInterface>(
        object: Model,
        property: string,
        options: FindOptions = {}
    ): Promise<Array<WithId<E>>> {
        return await this.em.getRelationships<E>(object, property, options);
    }

    fromPlain(data: object | object[], options?: ClassTransformOptions) {
        return this.em.fromPlain<Model>(this.classType, data, options);
    }

    merge(entity: Model | WithId<Model>, data: Model | WithId<Model>, excludePrefixes?: string[]) {
        return this.em.merge(entity, data, excludePrefixes);
    }

    async validate(entity: Model, validatorOptions: ValidatorOptions = {}, throwError: boolean = false) {
        return await this.em.validate(entity, validatorOptions, throwError);
    }
}

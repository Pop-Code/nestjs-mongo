import { ClassTransformOptions } from 'class-transformer';
import { ClassType } from 'class-transformer/ClassTransformer';
import { ChangeStream, Cursor } from 'mongodb';

import { MongoDataloader } from './dataloader/data';
import { ObjectId } from './helpers';
import { EntityInterface } from './interfaces/entity';
import { MongoManager } from './manager';

export class MongoRepository<Model extends EntityInterface> {
    constructor(
        protected readonly em: MongoManager,
        protected readonly classType: ClassType<Model>
    ) {}

    getClassType() {
        return this.classType;
    }

    getEm() {
        return this.em;
    }

    save(entity: Model, ...args: any[]): Promise<Model> {
        return this.em.save(entity, ...args);
    }

    watch(pipes?: any[], options?: any): ChangeStream {
        return this.em.getCollection(this.classType).watch(pipes, options);
    }

    async find(
        query?: any,
        options: { dataloader?: string } = {}
    ): Promise<Array<Model | Error>> {
        const dataloader = this.em.getDataloader<Model>(
            options.dataloader || this.classType.name
        );
        if (dataloader && this.em.isIdsQuery(query)) {
            return dataloader.loadMany(query._id.$in);
        }
        return (await this.em.find(this.classType, query, options)).toArray();
    }

    async findPaginated(query?: any, ...args: any[]): Promise<Cursor<Model>> {
        return await this.em.find(this.classType, query, ...args);
    }

    list(query?: any): Promise<Cursor<Model>> {
        return this.em.find(this.classType, query);
    }

    count(query?: any, ...args: any[]): Promise<number> {
        return this.em.count(this.classType, query, ...args);
    }

    findOne(query: any, ...args: any[]): Promise<Model> {
        return this.em.findOne(this.classType, query, ...args);
    }

    async findById(
        ids?: ObjectId[],
        ...args: any[]
    ): Promise<Array<Model | Error>> {
        return await this.find({ _id: { $in: ids } }, ...args);
    }

    deleteOne(query: any, ...args: any) {
        return this.em.deleteOne(this.classType, query, ...args);
    }

    deleteMany(query: any, ...args: any) {
        return this.em.deleteMany(this.classType, query, ...args);
    }

    getRelationship<E extends EntityInterface>(
        object: Model,
        property: string
    ): Promise<E> {
        return this.em.getRelationship<E>(object, property);
    }

    fromPlain(data: object, options?: ClassTransformOptions): Model {
        return this.em.fromPlain<Model>(this.classType, data, options);
    }

    merge(entity: Model, data: any, options?: ClassTransformOptions): Model {
        return this.em.merge(entity, data, options);
    }
}

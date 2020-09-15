import { ClassTransformOptions } from 'class-transformer';
import { ClassType } from 'class-transformer/ClassTransformer';
import { ChangeStream, Cursor } from 'mongodb';

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

    async save(entity: Model, ...args: any[]): Promise<Model> {
        return await this.em.save(entity, ...args);
    }

    watch(pipes?: any[], options?: any): ChangeStream {
        return this.em.getCollection(this.classType).watch(pipes, options);
    }

    async find(
        query?: any,
        options: { dataloader?: string } = {}
    ): Promise<Array<Model | Error>> {
        const dataloaderName =
            typeof options.dataloader === 'string'
                ? options.dataloader
                : this.classType.name;
        const dataloader = this.em.getDataloader<Model>(dataloaderName);
        if (dataloader !== undefined && this.em.isIdsQuery(query)) {
            return await dataloader.loadMany(query._id.$in);
        }
        return await (
            await this.em.find(this.classType, query, options)
        ).toArray();
    }

    async findPaginated(query?: any, ...args: any[]): Promise<Cursor<Model>> {
        return await this.em.find(this.classType, query, ...args);
    }

    async list(query?: any): Promise<Cursor<Model>> {
        return await this.em.find(this.classType, query);
    }

    async count(query?: any, ...args: any[]): Promise<number> {
        return await this.em.count(this.classType, query, ...args);
    }

    async findOne(query: any, ...args: any[]): Promise<Model | undefined> {
        return await this.em.findOne(this.classType, query, ...args);
    }

    async findById(
        ids?: ObjectId[],
        ...args: any[]
    ): Promise<Array<Model | Error>> {
        return await this.find({ _id: { $in: ids } }, ...args);
    }

    async deleteOne(query: any, ...args: any) {
        return await this.em.deleteOne(this.classType, query, ...args);
    }

    async deleteMany(query: any, ...args: any) {
        return await this.em.deleteMany(this.classType, query, ...args);
    }

    async getRelationship<E extends EntityInterface>(
        object: Model,
        property: string
    ): Promise<E | undefined> {
        return await this.em.getRelationship<E>(object, property);
    }

    fromPlain(data: object, options?: ClassTransformOptions): Model {
        return this.em.fromPlain<Model>(this.classType, data, options);
    }

    merge(entity: Model, data: any, options?: ClassTransformOptions): Model {
        return this.em.merge(entity, data, options);
    }
}

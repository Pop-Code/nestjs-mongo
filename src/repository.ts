import { MongoManager } from './manager';
import { Cursor } from 'mongodb';
import { ObjectId } from './helpers';
import { EntityInterface } from './interfaces/entity';
import { ClassType } from 'class-transformer/ClassTransformer';
import { ClassTransformOptions } from 'class-transformer';
import { get } from 'lodash';

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

    async find(query?: any, ...args: any[]): Promise<Model[]> {
        if (this.em.isIdsQuery(query)) {
            const dataloader = this.em.getDataloader<Model>(
                get(args, [0, 'dataloader'])
            );
            if (dataloader) {
                return dataloader.loadMany(query._id.$in);
            }
        }
        return (await this.em.find(this.classType, query, ...args)).toArray();
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
        if (this.em.isIdQuery(query)) {
            const dataloader = this.em.getDataloader<Model>(
                get(args, [0, 'dataloader'])
            );
            if (dataloader) {
                return dataloader.load(query._id);
            }
        }
        return this.em.findOne(this.classType, query, ...args);
    }

    async findById(ids?: ObjectId[], ...args: any[]): Promise<Model[]> {
        return await this.find({ _id: { $in: ids } }, ...args);
    }

    deleteOne(query: any, ...args: any) {
        return this.em.deleteOne(this.classType, query, ...args);
    }

    getRelationship<E extends EntityInterface>(
        object: Model,
        property: string
    ): Promise<E> {
        return this.em.getRelationship<E>(object, property);
    }

    fromPlain(data: Object, options?: ClassTransformOptions): Model {
        return this.em.fromPlain<Model>(this.classType, data, options);
    }

    merge(entity: Model, data: any, options?: ClassTransformOptions): Model {
        return this.em.merge(entity, data, options);
    }
}

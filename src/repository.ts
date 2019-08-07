import { MongoManager } from './manager';
import { Cursor } from 'mongodb';
import { ObjectId } from './helpers';
import { EntityInterface } from './interfaces/entity';
import { ClassType } from 'class-transformer/ClassTransformer';
import { ClassTransformOptions } from 'class-transformer';

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

    find(query?: any): Promise<Cursor<Model>> {
        return this.em.find(this.classType, query);
    }

    count(query?: any, ...args: any[]): Promise<number> {
        return this.em.count(this.classType, query, ...args);
    }

    findOne(query: any, ...args: any[]): Promise<Model> {
        return this.em.findOne(this.classType, query, ...args);
    }

    findOneById(id: string | ObjectId): Promise<Model> {
        return this.em.findOne(this.classType, { _id: id });
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
        return this.em.fromPlain<Model>(this.getClassType(), data, options);
    }

    merge(entity: Model, data: any, options?: ClassTransformOptions): Model {
        return this.em.merge(entity, data, options);
    }
}

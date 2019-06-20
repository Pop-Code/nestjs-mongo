import { MongoManager } from './manager';
import { Cursor } from 'mongodb';
import { ObjectId } from './helpers';
import { EntityInterface, EntityInterfaceStatic } from './interfaces/entity';

export class MongoRepository<Model extends EntityInterface> {
    constructor(
        protected readonly em: MongoManager,
        protected readonly classType: EntityInterfaceStatic
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

    getRelationship(object: Model, property: string): Promise<Model> {
        return this.em.getRelationship<Model>(object, property);
    }
}

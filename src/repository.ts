/**
 * @module nestjs-mongo
 */

import { MongoManager } from './manager';
import { Cursor } from 'mongodb';
import { ObjectId } from './helpers';
import { ClassType } from 'class-transformer/ClassTransformer';
import { Entity } from './entity';

export class MongoRepository<T extends Entity> {
    constructor(
        protected readonly em: MongoManager,
        protected readonly cls: ClassType<T>
    ) {}

    getEm() {
        return this.em;
    }

    save(entity: T, ...args: any[]): Promise<T> {
        return this.em.save(entity, ...args);
    }

    find(query?: any): Promise<Cursor<T>> {
        return this.em.find(this.cls, query);
    }

    count(query?: any, ...args: any[]): Promise<number> {
        return this.em.count(this.cls, query, ...args);
    }

    findOne(query: any, ...args: any[]): Promise<T> {
        return this.em.findOne(this.cls, query, ...args);
    }

    findOneById(id: string | ObjectId): Promise<T> {
        return this.em.findOne(this.cls, { _id: id });
    }

    deleteOne(query: any, ...args: any) {
        return this.em.deleteOne(this.cls, query, ...args);
    }

    getRelationship<R>(object: any, property: string): Promise<R> {
        return this.em.getRelationship(object, property);
    }
}

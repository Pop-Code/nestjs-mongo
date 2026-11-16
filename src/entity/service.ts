import { Injectable, NotFoundException } from '@nestjs/common';
import { isEmpty } from 'class-validator';
import Debug from 'debug';
import { camelCase } from 'lodash';
import { ChangeStreamDocument, Filter as MongoFilter, ObjectId, WithId } from 'mongodb';

import { DEBUG } from '../constants';
import { EventCallback } from '../event/event';
import { HistoryAction, HistoryActions } from '../history';
import { Filter } from './filter';
import { EntityInterface } from './interfaces';
import { PaginatedData } from './paginated';
import { EntityRepository } from './repository';

@Injectable()
/**
 * An optional base class for CRUD services built on a repository.
 *
 * Set the `repository` property (usually from the constructor) and get `create`, `get`, `list`,
 * `update`, `delete` and `subscribe` for free.
 */
export abstract class EntityService<
    Model extends EntityInterface,
    Repository extends EntityRepository<Model> = EntityRepository<Model>
> {
    protected repository: Repository;
    protected log: Debug.Debugger;

    constructor() {
        this.log = Debug(DEBUG + '_' + this.constructor.name);
    }

    /**
     * Add an action to the `history` of an entity (only if it has a `HistoryActions` history).
     */
    addHistory<Obj extends EntityInterface>(item: Obj, action: string, date?: Date) {
        if (item.history instanceof HistoryActions) {
            const historyAction = new HistoryAction(action, date !== undefined ? date : new Date());
            item.history.add(historyAction);
        }
        return this;
    }

    getRepository(): Repository {
        return this.repository;
    }

    /**
     * Create a model instance from plain data, and save it when `save` is true.
     */
    async create(data: any, save = false, ...rest: any[]): Promise<WithId<Model> | Model> {
        const item = this.repository.fromPlain(data);
        if (save) {
            return await this.repository.save(item, ...rest);
        }
        return item;
    }

    /**
     * Get an entity by id.
     *
     * @throws NotFoundException
     */
    async get(itemId: ObjectId, ...rest: any[]): Promise<WithId<Model>> {
        const filter = { _id: itemId } as MongoFilter<Model>;
        const item = await this.repository.findOne(filter, ...rest);
        if (item === undefined) {
            throw new NotFoundException();
        }
        return item;
    }

    /**
     * List entities with pagination and sorting from a {@link Filter}.
     *
     * @param ResponseType The class to instantiate for the response, usually {@link PaginatedData} or a subclass
     */
    async list(filter: Filter, ResponseType: any, ...rest: any[]): Promise<PaginatedData<Model>> {
        const cursor = await this.repository.find(filter.toQuery(), ...rest);
        if (!isEmpty(filter.orderBy)) {
            cursor.sort(filter.getSort());
        }
        const count = await this.repository.getCollection().countDocuments(filter.toQuery());
        cursor.skip(filter.skip).limit(filter.limit);
        const data = await cursor.toArray();
        const res = new ResponseType();
        res.count = count;
        res.data = data;
        return res;
    }

    /**
     * Merge data into an existing entity, and save it when `save` is true.
     *
     * @throws NotFoundException
     */
    async update(itemId: ObjectId, data: any, save = false, ...rest: any[]): Promise<WithId<Model> | Model> {
        const entity = await this.get(itemId);
        const item = this.repository.merge(entity, data);
        if (save) {
            return await this.repository.save(item, ...rest);
        }
        return item;
    }

    /**
     * Delete an entity by id.
     *
     * @throws NotFoundException
     */
    async delete(itemId: ObjectId, ...rest: any[]): Promise<void> {
        const filter = { _id: itemId } as MongoFilter<Model>;
        const { deletedCount } = await this.repository.deleteOne(filter, ...rest);
        if (deletedCount !== 1) {
            throw new NotFoundException();
        }
    }

    /**
     * Watch the collection and call `onData` for every change.
     *
     * The event name is built from the operation and the model name, for example `onInsertUser`
     * or `onUpdateUser`. `fullDocument` is transformed to a model instance.
     */
    subscribe(onData: EventCallback<WithId<Model>>) {
        return this.repository
            .watch([], { fullDocument: 'updateLookup' })
            .on('change', (change: ChangeStreamDocument<WithId<Model>>) => {
                // onData catches and logs its own errors
                void this.onData(change, onData);
            });
    }

    protected readonly onData = async (
        change: ChangeStreamDocument<WithId<Model>>,
        onData: EventCallback<WithId<Model>>
    ) => {
        try {
            const em = this.repository.getEm();
            const classType = this.repository.getClassType();
            const eventName = camelCase(`on_${change.operationType}_${classType.name}`);
            this.log('Event:%s for %s:%s', eventName, classType.name, change['documentKey']);
            if (change.operationType !== 'drop') {
                if (change['fullDocument'] !== undefined) {
                    change['fullDocument'] = em.fromPlain(classType, change['fullDocument']) as WithId<Model>;
                }
            }
            onData(eventName, change);
        } catch (e) {
            this.log('Entity listener error: %s', e.message);
        }
    };
}

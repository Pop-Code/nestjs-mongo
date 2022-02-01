import { Injectable, NotFoundException } from '@nestjs/common';
import { isEmpty } from 'class-validator';
import Debug from 'debug';
import { camelCase } from 'lodash';
import { ChangeStreamDocument, Filter as MongoFilter, ObjectId } from 'mongodb';

import { DEBUG } from '../constants';
import { EventCallback } from '../event/event';
import { HistoryAction, HistoryActions } from '../history';
import { Filter } from './filter';
import { EntityInterface } from './interfaces';
import { PaginatedData } from './paginated';
import { EntityRepository } from './repository';

@Injectable()
export abstract class EntityService<
    Model extends EntityInterface,
    Repository extends EntityRepository<Model> = EntityRepository<Model>
> {
    protected repository: Repository;
    protected log: Debug.Debugger;

    constructor() {
        this.log = Debug(DEBUG + '_' + this.constructor.name);
    }

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

    async create(data: any, save = false, ...rest: any[]): Promise<Model> {
        const item = this.repository.fromPlain(data);
        if (save) {
            return await this.repository.save(item, ...rest);
        }
        return item;
    }

    async get(itemId: ObjectId, ...rest: any[]): Promise<Model> {
        const filter: MongoFilter<Model> = {};
        filter._id = itemId;
        const item = await this.repository.findOne(filter, ...rest);
        if (item === undefined) {
            throw new NotFoundException();
        }
        return item;
    }

    async list(filter: Filter, ResponseType: any, ...rest: any[]): Promise<PaginatedData<Model>> {
        const cursor = await this.repository.find(filter.toQuery());

        if (!isEmpty(filter.orderBy)) {
            cursor.sort(filter.getSort());
        }

        const count = await cursor.count();

        cursor.skip(filter.skip).limit(filter.limit);
        const data = await cursor.toArray();

        const res = new ResponseType();
        res.count = count;
        res.data = data;

        return res;
    }

    async update(itemId: ObjectId, data: any, save = false, ...rest: any[]): Promise<Model> {
        const entity = await this.get(itemId);
        const item = this.repository.merge(entity, data);
        if (save) {
            return await this.repository.save(item, ...rest);
        }
        return item;
    }

    async delete(itemId: ObjectId, ...rest: any[]): Promise<void> {
        const filter: MongoFilter<Model> = {};
        filter._id = itemId;
        const { deletedCount } = await this.repository.deleteOne(filter, ...rest);
        if (deletedCount !== 1) {
            throw new NotFoundException();
        }
    }

    subscribe(onData: EventCallback<Model>) {
        return this.repository
            .watch([], { fullDocument: 'updateLookup' })
            .on('change', (change: ChangeStreamDocument<Model>) => {
                this.onData(change, onData).catch((e) => {
                    throw e;
                });
            });
    }

    protected readonly onData = async (change: ChangeStreamDocument<Model>, onData: EventCallback<Model>) => {
        try {
            const em = this.repository.getEm();
            const classType = this.repository.getClassType();
            const eventName = camelCase(`on_${change.operationType}_${classType.name}`);
            this.log('Event:%s for %s:%s', eventName, classType.name, change.documentKey);
            if (change.fullDocument !== undefined) {
                change.fullDocument = em.fromPlain<Model>(classType, change.fullDocument);
            }
            onData(eventName, change);
        } catch (e) {
            this.log('Entity listener error: %s', e.message);
        }
    };
}

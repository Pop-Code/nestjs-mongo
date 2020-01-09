import { Injectable, NotFoundException } from '@nestjs/common';
import Debug from 'debug';
import { Filter } from './classes/filter';
import { HistoryActions } from './classes/history';
import { HistoryAction } from './classes/history.action';
import { PaginatedData } from './classes/paginated';
import { DEBUG } from './constants';
import { EntityInterface } from './interfaces/entity';
import { MongoRepository } from './repository';
import { ObjectId, ChangeStream } from 'mongodb';
import { camelCase } from 'lodash';
import { EventCallback } from './interfaces/event';

@Injectable()
export abstract class EntityService<
    Model extends EntityInterface,
    Repository extends MongoRepository<Model> = MongoRepository<Model>
> {
    protected repository: Repository;
    protected log: Debug.Debugger;

    constructor() {
        this.log = Debug(DEBUG + '_' + this.constructor.name);
    }

    addHistory<Obj extends EntityInterface>(
        item: Obj,
        action: string,
        date?: Date
    ) {
        if (
            item.hasOwnProperty('history') &&
            item.history instanceof HistoryActions
        ) {
            const historyAction = new HistoryAction(action, date || new Date());
            item.history.add(historyAction);
        }
        return this;
    }

    getRepository(): Repository {
        return this.repository;
    }

    async create(
        data: any,
        save: boolean = false,
        ...rest: any[]
    ): Promise<Model> {
        const item = this.repository.fromPlain(data);
        this.addHistory(item, 'Item created');
        if (save) {
            return this.repository.save(item, ...rest);
        }
        return item;
    }

    async get(itemId: ObjectId, ...rest: any[]): Promise<Model> {
        const item = await this.repository.findOne({ _id: itemId }, ...rest);
        if (!item) {
            throw new NotFoundException();
        }
        return item;
    }

    async list(
        filter: Filter,
        responseType: any,
        ...rest: any[]
    ): Promise<PaginatedData<Model>> {
        let items = (await this.repository.findPaginated(filter.toQuery()))
            .skip(filter.skip)
            .limit(filter.limit);

        if (filter.orderBy) {
            items = items.sort(filter.getSort());
        }

        const count = await items.count(false);
        const data = await items.toArray();

        const res = new responseType();
        res.count = count;
        res.data = data;

        return res;
    }

    async update(
        itemId: ObjectId,
        data: any,
        save: boolean = false,
        ...rest: any[]
    ): Promise<Model> {
        const entity = await this.get(itemId);
        const item = this.repository.merge(entity, data);
        this.addHistory(item, 'Item updated');
        if (save) {
            return this.repository.save(item, ...rest);
        }
        return item;
    }

    async delete(itemId: ObjectId, ...rest: any[]): Promise<void> {
        const { result } = await this.repository.deleteOne(
            {
                _id: itemId
            },
            ...rest
        );
        if (result.n !== 1) {
            throw new NotFoundException();
        }
    }

    /**
     * Subscribe to a a change stream.
     */
    subscribe(onData: EventCallback<Model>): ChangeStream {
        return this.repository
            .watch([], { updateLookup: 'fullDocument' })
            .on('change', (change: any) => this._onData(change, onData));
    }

    private _onData = async (change: any, onData: EventCallback<Model>) => {
        try {
            const em = this.repository.getEm();
            const classType = this.repository.getClassType();
            const { operationType, fullDocument } = change;
            let operation = operationType;

            if (operationType === 'insert') {
                operation = 'create';
            }
            if (operationType === 'replace') {
                operation = 'update';
            }
            if (['create', 'update', 'delete'].indexOf(operation) === -1) {
                return;
            }

            const eventName = camelCase(`on_${operation}_${classType.name}`);
            this.log(
                'Event:%s for %s:%s',
                eventName,
                classType.name,
                change.documentKey._id
            );
            if (operation === 'delete') {
                onData(eventName, operation, change.documentKey._id);
            } else {
                onData(
                    eventName,
                    operation,
                    em.fromPlain(classType, fullDocument)
                );
            }
        } catch (e) {
            this.log('Entity listener error: %s', e.message);
        }
    }
}

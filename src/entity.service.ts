import { Injectable, NotFoundException } from '@nestjs/common';
import { isEmpty } from 'class-validator';
import Debug from 'debug';
import { camelCase } from 'lodash';
import { ChangeEvent, ChangeStream, ObjectId } from 'mongodb';

import { Filter } from './classes/filter';
import { HistoryActions } from './classes/history';
import { HistoryAction } from './classes/history.action';
import { PaginatedData } from './classes/paginated';
import { DEBUG } from './constants';
import { EntityInterface } from './interfaces/entity';
import { EventCallback, EventType, SupportedChangeEvent } from './interfaces/event';
import { MongoRepository } from './repository';

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
        if (item.history instanceof HistoryActions) {
            const historyAction = new HistoryAction(
                action,
                date !== undefined ? date : new Date()
            );
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
        const item = await this.repository.findOne({ _id: itemId }, ...rest);
        if (item === undefined) {
            throw new NotFoundException();
        }
        return item;
    }

    async list(
        filter: Filter,
        ResponseType: any,
        ...rest: any[]
    ): Promise<PaginatedData<Model>> {
        let items = (await this.repository.findPaginated(filter.toQuery()))
            .skip(filter.skip)
            .limit(filter.limit);

        if (!isEmpty(filter.orderBy)) {
            items = items.sort(filter.getSort());
        }

        const count = await items.count(false);
        const data = await items.toArray();

        const res = new ResponseType();
        res.count = count;
        res.data = data;

        return res;
    }

    async update(
        itemId: ObjectId,
        data: any,
        save = false,
        ...rest: any[]
    ): Promise<Model> {
        const entity = await this.get(itemId);
        const item = this.repository.merge(entity, data);
        if (save) {
            return await this.repository.save(item, ...rest);
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
            .watch([], { fullDocument: 'updateLookup' })
            .on('change', (change) => {
                this.onData(change, onData).catch((e) => {
                    throw e;
                });
            });
    }

    protected readonly onData = async (
        change: ChangeEvent<Model>,
        onData: EventCallback<Model>
    ) => {
        try {
            const em = this.repository.getEm();
            const classType = this.repository.getClassType();
            const { operationType } = change;
            let operation: EventType | undefined;
            if (operationType === 'insert') {
                operation = 'create';
            } else if (
                operationType === 'replace' ||
                operationType === 'update'
            ) {
                operation = 'update';
            } else if (operationType === 'delete') {
                operation = 'delete';
            }
            if (operation === undefined) {
                return;
            }
            if (!['create', 'update', 'delete'].includes(operation)) {
                return;
            }
            const changeCast = change as SupportedChangeEvent<Model>;
            let fullDocument: any;
            if ((change as any).fullDocument !== undefined) {
                fullDocument = (change as any).fullDocument;
            }

            const eventName = camelCase(`on_${operation}_${classType.name}`);
            this.log(
                'Event:%s for %s:%s',
                eventName,
                classType.name,
                changeCast.documentKey._id
            );
            if (operation === 'delete') {
                onData(
                    eventName,
                    operation,
                    changeCast.documentKey._id,
                    changeCast
                );
            } else {
                onData(
                    eventName,
                    operation,
                    em.fromPlain<Model>(classType, fullDocument),
                    changeCast
                );
            }
        } catch (e) {
            this.log('Entity listener error: %s', e.message);
        }
    };
}

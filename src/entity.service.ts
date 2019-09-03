import { Injectable, NotFoundException } from '@nestjs/common';
import Debug from 'debug';
import { Filter } from './classes/filter';
import { HistoryActions } from './classes/history';
import { HistoryAction } from './classes/history.action';
import { PaginatedResponse } from './classes/paginated.response';
import { DEBUG } from './constants';
import { EntityInterface } from './interfaces/entity';
import { MongoRepository } from './repository';
import { ObjectId } from 'mongodb';

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
        if (save) return this.repository.save(item, ...rest);
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
    ): Promise<PaginatedResponse> {
        let items = (await this.repository.findPaginated(filter.toQuery()))
            .skip(filter.skip)
            .limit(filter.limit);

        if (filter.orderBy) {
            items = items.sort(filter.sort);
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
        if (save) return this.repository.save(item, ...rest);
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
}

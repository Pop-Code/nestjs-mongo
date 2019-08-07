import { Injectable, NotFoundException } from '@nestjs/common';
import Debug from 'debug';
import { Filter } from './classes/filter';
import { HistoryActions } from './classes/history';
import { HistoryAction } from './classes/history.action';
import { PaginatedResponse } from './classes/paginated.response';
import { DEBUG } from './constants';
import { EntityInterface } from './interfaces/entity';
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

    addHistory(item: Model, action: string, date?: Date) {
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

    async create(data: any, save: boolean = false): Promise<Model> {
        const type = this.repository.getClassType();
        const item = this.repository.fromPlain(data);
        this.addHistory(item, 'Item created');
        if (save) return this.repository.save(item);
        return item;
    }

    async get(item: Model, context?: any): Promise<Model> {
        return item;
    }

    async list(filter: Filter, responseType: any): Promise<PaginatedResponse> {
        let items = (await this.repository.find(filter.toQuery()))
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
        entity: Model,
        data: any,
        save: boolean = false
    ): Promise<Model> {
        const item = this.repository.merge(entity, data);
        this.addHistory(item, 'Item updated');
        if (save) return this.repository.save(item);
        return item;
    }

    async delete(item: Model): Promise<void> {
        const { result } = await this.repository.deleteOne({
            _id: item._id
        });
        if (result.n !== 1) {
            throw new NotFoundException();
        }
    }
}

/**
 * @module nestjs-mongo
 */

import { Injectable, Logger } from '@nestjs/common';
import { MongoRepository } from '.';
import { EntityInterface } from './interfaces/entity';
import { HistoryActions } from './classes/history';
import { HistoryAction } from './classes/history.action';

@Injectable()
export abstract class EntityService<
    T extends EntityInterface,
    R extends MongoRepository<T> = MongoRepository<T>
> {
    protected repository: R;
    protected logger: Logger;

    constructor() {
        this.logger = new Logger(this.constructor.name);
    }

    addHistory(item: T, action: string, date?: Date) {
        if (
            item.hasOwnProperty('history') &&
            item.history instanceof HistoryActions
        ) {
            const historyAction = new HistoryAction(action, date || new Date());
            item.history.add(historyAction);
        }
        return this;
    }

    getRepository(): R {
        return this.repository;
    }
}

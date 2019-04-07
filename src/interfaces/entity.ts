/**
 * @module nestjs-mongo
 */

import { ObjectId } from '../helpers';
import { HistoryActions } from '../classes/history';

export interface EntityInterface {
    _id: ObjectId;
    readonly id: string;
    createdAt: Date;
    updatedAt?: Date;
    toJSON(): {};
    merge<T>(data: any, options?: any): T;
    history?: HistoryActions;
}

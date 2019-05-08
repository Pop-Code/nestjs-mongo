import { ObjectId } from '../helpers';
import { HistoryActions } from '../classes/history';
import { ClassTransformOptions } from 'class-transformer';

export interface EntityInterface {
    _id: ObjectId;
    createdAt: Date;
    updatedAt?: Date;
    toJSON(): {};
    merge<T>(data: any, options?: ClassTransformOptions): T;
    history?: HistoryActions;
}

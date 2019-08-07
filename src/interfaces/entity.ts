import { ObjectId } from '../helpers';
import { HistoryActions } from '../classes/history';

export interface EntityInterface {
    _id: ObjectId;
    createdAt: Date;
    updatedAt?: Date;
    history?: HistoryActions;
    toJSON(): Object;
}

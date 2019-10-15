import { ObjectId } from '../helpers';
import { HistoryActions } from '../classes/history';
import { ISerializable } from '../serializer';

export interface EntityInterface extends ISerializable {
    _id: ObjectId;
    createdAt: Date;
    updatedAt?: Date;
    history?: HistoryActions;
}

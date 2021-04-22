import { HistoryActions } from '../classes/history';
import { ObjectId } from '../helpers';
import { ISerializable } from '../serializer';

export interface EntityInterface extends ISerializable {
    _id: ObjectId;
    createdAt: Date;
    updatedAt?: Date;
    history?: HistoryActions;
}

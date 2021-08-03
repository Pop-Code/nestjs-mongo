import { ObjectId } from 'mongodb';

import { HistoryActions } from '../history';
import { SerializableInterface } from '../serializer';

export interface EntityInterface extends SerializableInterface {
    _id: ObjectId;
    createdAt: Date;
    updatedAt?: Date;
    history?: HistoryActions;
}

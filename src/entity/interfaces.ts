import { ObjectId } from 'mongodb';

import { HistoryActions } from '../history';
import { SerializableInterface } from '../serializer';

/**
 * The interface of a model. Extend {@link Entity} instead of implementing it yourself.
 */
export interface EntityInterface extends SerializableInterface {
    _id?: ObjectId;
    createdAt: Date;
    updatedAt?: Date;
    history?: HistoryActions;
}

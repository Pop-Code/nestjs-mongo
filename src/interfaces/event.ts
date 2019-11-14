import { EntityInterface } from './entity';
import { ObjectId } from 'mongodb';

export type EventCallback<Model extends EntityInterface> = (
    eventName: string,
    eventType: 'create' | 'update' | 'delete',
    entity: Model | ObjectId
) => void;

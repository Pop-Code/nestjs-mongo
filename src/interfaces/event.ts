import { EntityInterface } from './entity';
import { ObjectId } from 'mongodb';

export type EventType = 'create' | 'update' | 'delete';

export type EventCallback<Model extends EntityInterface> = (
    eventName: string,
    eventType: EventType,
    entity: Model | ObjectId
) => void;

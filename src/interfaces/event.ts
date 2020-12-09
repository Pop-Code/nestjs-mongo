import { ChangeEventCR, ChangeEventDelete, ChangeEventUpdate, ObjectId } from 'mongodb';

import { EntityInterface } from './entity';

export type EventType = 'create' | 'update' | 'delete';
export type SupportedChangeEvent<M = any> =
    | ChangeEventUpdate<M>
    | ChangeEventDelete<M>
    | ChangeEventCR<M>;
export type EventCallback<Model extends EntityInterface> = (
    eventName: string,
    eventType: EventType,
    entity: Model | ObjectId,
    originalEvent: SupportedChangeEvent<Model>
) => void;

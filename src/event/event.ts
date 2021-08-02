import { ChangeStreamDocument } from 'mongodb';

import { EntityInterface } from '../entity/interfaces';

// export type EventType = 'create' | 'update' | 'delete';

// export type SupportedChangeEvent<M = any> = ChangeEventUpdate<M> | ChangeEventDelete<M> | ChangeEventCR<M>;

export type EventCallback<Model extends EntityInterface> = (
    eventName: string,
    change: ChangeStreamDocument<Model>
    // entity?: Model | ObjectId
    // originalEvent: SupportedChangeEvent<Model>
) => void;

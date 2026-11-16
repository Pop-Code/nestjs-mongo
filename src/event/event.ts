import { ChangeStreamDocument } from 'mongodb';

import { EntityInterface } from '../entity/interfaces';

/**
 * The callback of {@link EntityService.subscribe}.
 *
 * @param eventName The operation and the model name, for example `onInsertUser`
 * @param change The change stream event, with `fullDocument` transformed to a model instance
 */
export type EventCallback<Model extends EntityInterface> = (
    eventName: string,
    change: ChangeStreamDocument<Model>
) => void;

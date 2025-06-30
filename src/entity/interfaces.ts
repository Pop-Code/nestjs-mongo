import { WithId } from 'mongodb'

import { HistoryActions } from '../history'
import type { SerializableInterface } from '../serializer'

export interface BaseEntityInterface extends SerializableInterface {
  createdAt: Date
  updatedAt?: Date
  history?: HistoryActions
}

export interface EntityInterface extends BaseEntityInterface, WithId<BaseEntityInterface> {}

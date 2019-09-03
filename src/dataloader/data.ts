import BaseDataloader from 'dataloader';
import { ObjectId } from 'mongodb';

export class MongoDataloader<M> extends BaseDataloader<ObjectId, M> {}

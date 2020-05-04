import * as BaseDataloader from 'dataloader';
import { ObjectId } from 'mongodb';

export class MongoDataloader<Model> extends BaseDataloader<
    ObjectId,
    Model,
    string
    > {
    uuid: string;
}

import { ObjectId } from '../helpers';
import { HistoryActions } from '../classes/history';
import { ClassTransformOptions } from 'class-transformer';

export interface EntityInterface {
    _id: ObjectId;
    createdAt: Date;
    updatedAt?: Date;
    toJSON(): {};
    merge<Model>(data: any, options?: ClassTransformOptions): Model;
    history?: HistoryActions;
}

export interface EntityInterfaceStatic {
    new (): EntityInterface;
    fromPlain<Model extends EntityInterface>(
        data: Object,
        options?: ClassTransformOptions
    ): Model;
}

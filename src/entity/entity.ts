import { Type } from 'class-transformer';
import { IsDate, IsOptional } from 'class-validator';
import { ObjectId } from 'mongodb';

import { Serializable, SerializableInterface } from '../serializer';
import { TypeObjectId } from '../transformer/objectId';
import { EntityInterface } from './interfaces';

export interface Entity extends SerializableInterface {}

@Serializable()
export abstract class Entity implements EntityInterface {
    @TypeObjectId()
    _id: ObjectId;

    @Type(() => Date)
    @IsDate()
    createdAt: Date = new Date();

    @Type(() => Date)
    @IsDate()
    @IsOptional()
    updatedAt?: Date;
}

import { Type } from 'class-transformer';
import { Allow, IsDate, IsOptional } from 'class-validator';
import { ClientSession } from 'mongodb';

import { TypeObjectId } from './decorators';
import { ObjectId } from './helpers';
import { EntityInterface } from './interfaces/entity';
import { ISerializable, Serializable } from './serializer';

export interface Entity extends ISerializable {}

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

    @Allow()
    __session?: ClientSession;
}

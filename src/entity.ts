import { ApiModelProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional } from 'class-validator';
import { TypeObjectId } from './decorators';
import { ObjectId } from './helpers';
import { EntityInterface } from './interfaces/entity';
import { Serializable, ISerializable } from './serializer';

export interface Entity extends ISerializable {}

@Serializable()
export abstract class Entity implements EntityInterface {
    @ApiModelProperty({
        description: 'The entity identifier',
        type: 'string'
    })
    @TypeObjectId()
    _id: ObjectId;

    @ApiModelProperty({
        description: 'The creation date',
        type: 'string',
        format: 'date-time'
    })
    @Type(() => Date)
    @IsDate()
    createdAt: Date = new Date();

    @ApiModelProperty({
        description: 'The last update date',
        type: 'string',
        format: 'date-time',
        required: false
    })
    @Type(() => Date)
    @IsDate()
    @IsOptional()
    updatedAt?: Date;
}

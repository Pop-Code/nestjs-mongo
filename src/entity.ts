import { ApiModelProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional } from 'class-validator';
import { TypeObjectId, WithJSONSerialize } from './decorators';
import { ObjectId } from './helpers';
import { EntityInterface } from './interfaces/entity';
import { WithJSONSerializeInterface } from './interfaces/jsonserialize';

export interface Entity extends WithJSONSerializeInterface {}

@WithJSONSerialize()
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

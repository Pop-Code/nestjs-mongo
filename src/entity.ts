import { ApiModelProperty } from '@nestjs/swagger';
import {
    classToClassFromExist,
    ClassTransformOptions,
    plainToClass,
    Type
} from 'class-transformer';
import { ClassType } from 'class-transformer/ClassTransformer';
import { IsDate, IsOptional } from 'class-validator';
import { TypeObjectId, WithJSONSerialize } from './decorators';
import { ObjectId } from './helpers';
import { EntityInterface } from './interfaces/entity';
import { JSONSerialize } from './interfaces/jsonserialize';

export interface Entity extends JSONSerialize {}

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

    static fromPlain<K, T>(
        cls: ClassType<K>,
        data: T,
        options?: ClassTransformOptions
    ): K {
        return plainToClass<K, T>(cls, data, options);
    }

    merge<T>(data: any, options?: ClassTransformOptions): T {
        return classToClassFromExist(data, this, options);
    }
}

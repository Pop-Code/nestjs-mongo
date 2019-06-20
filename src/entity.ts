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
import { EntityInterface, EntityInterfaceStatic } from './interfaces/entity';
import { WithJSONSerializeInterface } from './interfaces/jsonserialize';

export interface Entity extends WithJSONSerializeInterface {}

@WithJSONSerialize()
export abstract class Entity implements EntityInterface {
    constructor() {}

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

    merge<T>(data: any, options?: ClassTransformOptions): T {
        return classToClassFromExist(data, this, {
            ...options,
            excludePrefixes: ['__']
        });
    }

    static fromPlain<Model extends Entity>(
        data: Object,
        options?: ClassTransformOptions
    ): Model {
        const type = this;
        return plainToClass(type as any, data, {
            ...options,
            excludePrefixes: ['__']
        });
    }
}

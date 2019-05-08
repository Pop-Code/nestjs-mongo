import {
    Type,
    Transform,
    Expose,
    Exclude,
    plainToClass,
    ClassTransformOptions,
    classToClassFromExist,
    classToPlain
} from 'class-transformer';
import { ObjectId } from './helpers';
import { ObjectIdTransformer, TypeObjectId } from './decorators';
import { EntityInterface } from './interfaces/entity';
import { ApiModelProperty } from '@nestjs/swagger';
import { IsDate, IsOptional, Allow } from 'class-validator';
import { ClassType } from 'class-transformer/ClassTransformer';

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

    toJSON() {
        return classToPlain<Entity>(this);
    }

    merge<T>(data: any, options?: ClassTransformOptions): T {
        return classToClassFromExist(data, this, options);
    }
}

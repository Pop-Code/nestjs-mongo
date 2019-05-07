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
import { ObjectIdTransformer } from './decorators';
import { EntityInterface } from './interfaces/entity';
import { ApiModelProperty } from '@nestjs/swagger';
import { IsDate, IsOptional, Allow } from 'class-validator';

export abstract class Entity implements EntityInterface {
    @Type(() => String)
    @Exclude({ toPlainOnly: true })
    @Allow()
    @Transform(ObjectIdTransformer)
    _id: ObjectId;

    @ApiModelProperty({
        description: 'The identifier',
        type: 'string'
    })
    @Type(() => String)
    @Expose()
    get id() {
        return this._id && this._id.toHexString();
    }

    set id(value) {
        if (!value) {
            return;
        }
        this._id = new ObjectId(value);
    }

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
        cls: any,
        data: T,
        options?: ClassTransformOptions
    ): K {
        return plainToClass<K, T>(cls, data, options);
    }

    toJSON() {
        return classToPlain<this>(this);
    }

    merge<T>(data: any, options?: ClassTransformOptions): T {
        return classToClassFromExist(data, this, options);
    }
}

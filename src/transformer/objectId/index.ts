import { applyDecorators } from '@nestjs/common';
import { Transform, TransformationType, Type } from 'class-transformer';
import { Allow } from 'class-validator';
import { ObjectId } from 'mongodb';

export * from './objectid.pipe';

export const transformObjectId = (type: TransformationType, value: string | ObjectId) => {
    if (type === TransformationType.CLASS_TO_CLASS) {
        return value;
    } else if (type === TransformationType.PLAIN_TO_CLASS) {
        return new ObjectId(value);
    } else if (type === TransformationType.CLASS_TO_PLAIN) {
        if (value instanceof ObjectId) {
            return value.toHexString();
        } else {
            return value;
        }
    }
};

export function TypeObjectId(isArray?: boolean) {
    const typefn = Type(() => ObjectId);
    const trfn = Transform((params) => {
        const value = params.obj[params.key];
        if (value === undefined) {
            return;
        }
        if (Array.isArray(value) && isArray === true) {
            return value.map((v) => transformObjectId(params.type, v));
        } else {
            return transformObjectId(params.type, value);
        }
    });
    const allowfn = Allow();
    return applyDecorators(typefn, trfn, allowfn);
}

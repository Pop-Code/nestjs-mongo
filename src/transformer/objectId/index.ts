import { applyDecorators } from '@nestjs/common';
import { Transform, TransformationType, Type } from 'class-transformer';
import { Allow } from 'class-validator';
import { ObjectId } from 'mongodb';

import { setFieldMetadata } from '../../mapping/metadata';

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

/**
 * Transform a property to `ObjectId` from plain data, and to a hex string to plain data.
 *
 * @param isArray Set to true for an array of ObjectIds
 */
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
    const fieldfn = (target: object, property: string | symbol) =>
        setFieldMetadata(target, String(property), { type: () => ObjectId, isArray: isArray === true });
    return applyDecorators(typefn, trfn, allowfn, fieldfn);
}

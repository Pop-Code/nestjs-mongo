import { getMetadataStorage, ValidationTypes } from 'class-validator';
import { ObjectId } from 'mongodb';

import { ClassType, getFieldsMetadata } from '../mapping/metadata';

/** A `$jsonSchema` of MongoDB. */
export interface JsonSchema {
    bsonType?: string | string[];
    required?: string[];
    properties?: Record<string, JsonSchema>;
    items?: JsonSchema;
    enum?: unknown[];
}

const BSON_TYPES: Record<string, string | string[]> = {
    isString: 'string',
    isMongoId: 'string',
    isInt: ['int', 'long'],
    isNumber: ['double', 'int', 'long', 'decimal'],
    isBoolean: 'bool',
    isDate: 'date',
    isObject: 'object'
};

const typeOfField = (type: any): string | undefined => {
    if (type === ObjectId) return 'objectId';
    if (type === Date) return 'date';
    if (type === String) return 'string';
    if (type === Number) return 'number';
    if (type === Boolean) return 'bool';
    if (typeof type === 'function') return 'object';
    return undefined;
};

const withNull = (bsonType: string | string[]): string[] => [
    ...(Array.isArray(bsonType) ? bsonType : [bsonType]),
    'null'
];

/**
 * Generates the `$jsonSchema` of a class from its class-validator decorators (`@IsString()`, `@IsInt()`, `@IsNumber()`,
 * `@IsBoolean()`, `@IsDate()`, `@IsArray()`, `@IsIn()`, `@IsEnum()`, `@IsOptional()`, `@ValidateNested()`)
 * and its `@Field()` / `@Embedded()` / `@TypeObjectId()` decorators.
 *
 * The properties without a `@IsOptional()` or `@ValidateIf()` decorator are required.
 * The properties that are not declared are allowed.
 */
export function getJsonSchema(classType: ClassType, seen: Set<ClassType> = new Set()): JsonSchema {
    seen.add(classType);
    const metadatas = getMetadataStorage().getTargetValidationMetadatas(classType, '', true, false);
    const fields = getFieldsMetadata(classType);
    const properties: Record<string, JsonSchema> = { _id: { bsonType: 'objectId' } };
    const required = new Set<string>();
    const optional = new Set<string>();

    const names = new Set([...metadatas.map((m) => m.propertyName), ...Object.keys(fields)]);
    for (const name of names) {
        if (name === '_id') continue;
        const schema: JsonSchema = {};
        let isArray = fields[name]?.isArray === true;
        let itemType: string | string[] | undefined = typeOfField(fields[name]?.type?.());
        let itemSchema: JsonSchema | undefined;
        const fieldType = fields[name]?.type?.();
        let hasType = itemType !== undefined;

        for (const metadata of metadatas.filter((m) => m.propertyName === name)) {
            if (metadata.type === ValidationTypes.CONDITIONAL_VALIDATION) {
                optional.add(name);
                continue;
            }
            if (metadata.type === ValidationTypes.NESTED_VALIDATION) {
                if (typeof fieldType === 'function' && itemType === 'object' && !seen.has(fieldType)) {
                    itemSchema = getJsonSchema(fieldType, new Set(seen));
                }
                continue;
            }
            const constraintName = metadata.name ?? '';
            if (metadata.each === true) isArray = true;
            if (constraintName === 'isArray') {
                isArray = true;
                hasType = true;
            } else if (constraintName === 'isIn') {
                schema.enum = metadata.constraints[0];
                hasType = true;
            } else if (constraintName === 'isEnum') {
                // the keys of a numeric enum include the reverse mappings
                const entity = metadata.constraints[0] ?? {};
                schema.enum = Object.keys(entity)
                    .filter((key) => Number.isNaN(Number(key)))
                    .map((key) => entity[key]);
                hasType = true;
            } else if (BSON_TYPES[constraintName] !== undefined && itemType === undefined) {
                itemType = BSON_TYPES[constraintName];
                hasType = true;
            }
        }

        if (!hasType) continue;
        if (isArray) {
            schema.bsonType = 'array';
            if (itemType !== undefined || itemSchema !== undefined || schema.enum !== undefined) {
                // the values of an array are the items of the array
                schema.items = {
                    ...(itemType !== undefined ? { bsonType: itemType } : {}),
                    ...itemSchema,
                    ...(schema.enum !== undefined ? { enum: schema.enum } : {})
                };
                delete schema.enum;
            }
        } else if (itemType !== undefined) {
            schema.bsonType = itemType;
            Object.assign(schema, itemSchema);
        }
        if (itemSchema !== undefined && !isArray) {
            schema.bsonType = 'object';
        }
        properties[name] = schema;
        required.add(name);
    }

    for (const name of optional) {
        required.delete(name);
        const schema = properties[name];
        if (schema?.bsonType !== undefined) schema.bsonType = withNull(schema.bsonType);
        if (schema?.enum !== undefined) schema.enum = [...schema.enum, null];
    }

    return {
        bsonType: 'object',
        ...(required.size > 0 ? { required: [...required].sort() } : {}),
        properties
    };
}

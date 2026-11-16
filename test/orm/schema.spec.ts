import 'reflect-metadata';

import {
    IsArray,
    IsBoolean,
    IsEnum,
    IsIn,
    IsMongoId,
    IsNumber,
    IsOptional,
    IsString,
    ValidateIf,
    ValidateNested
} from 'class-validator';
import { ObjectId } from 'mongodb';

import { Embedded, Entity, Field, getJsonSchema, TypeObjectId } from '../../src';
import { Address, Customer } from './entities';

enum Color {
    Red = 'red',
    Blue = 'blue'
}

enum Level {
    Low,
    High
}

class Node {
    @IsString()
    name: string;

    @IsOptional()
    @ValidateNested()
    @Embedded(() => Node)
    child?: Node;
}

class Everything extends Entity {
    @IsNumber()
    amount: number;

    @IsBoolean()
    active: boolean;

    @IsMongoId()
    externalId: string;

    @IsIn(['a', 'b'])
    letter: string;

    @IsEnum(Color)
    color: Color;

    @IsOptional()
    @IsEnum(Level)
    level?: Level;

    @IsArray()
    @IsIn(['x', 'y'], { each: true })
    letters: string[];

    @IsString({ each: true })
    names: string[];

    @TypeObjectId(true)
    ids: ObjectId[];

    @Field(() => Number)
    counter: number;

    @Field(() => Boolean)
    flag: boolean;

    @Field(() => String)
    label: string;

    @ValidateIf((o: Everything) => o.active)
    @IsString()
    reason?: string;

    @IsOptional()
    @ValidateNested()
    @Embedded(() => Node)
    tree?: Node;

    @Embedded(() => Address, { isArray: true })
    @ValidateNested({ each: true })
    addresses: Address[];

    @Field()
    untyped: unknown;
}

describe('getJsonSchema', () => {
    it('should generate the schema of a model', () => {
        const schema = getJsonSchema(Customer);
        expect(schema.bsonType).toBe('object');
        expect(schema.required).toEqual(['createdAt', 'name']);
        expect(schema.properties).toMatchObject({
            _id: { bsonType: 'objectId' },
            name: { bsonType: 'string' },
            visits: { bsonType: ['int', 'long', 'null'] },
            tags: { bsonType: ['array', 'null'], items: { bsonType: 'string' } },
            ownerId: { bsonType: ['objectId', 'null'] },
            updatedAt: { bsonType: ['date', 'null'] },
            address: {
                bsonType: ['object', 'null'],
                required: ['city', 'street'],
                properties: { street: { bsonType: 'string' } }
            },
            addresses: { bsonType: ['array', 'null'], items: { bsonType: 'object', required: ['city', 'street'] } }
        });
        expect(schema.properties).not.toHaveProperty('transient');
    });

    it('should map the validation decorators', () => {
        const { properties, required } = getJsonSchema(Everything);
        expect(properties).toMatchObject({
            amount: { bsonType: ['double', 'int', 'long', 'decimal'] },
            active: { bsonType: 'bool' },
            externalId: { bsonType: 'string' },
            letter: { enum: ['a', 'b'] },
            color: { enum: ['red', 'blue'] },
            level: { enum: [0, 1, null] },
            letters: { bsonType: 'array', items: { enum: ['x', 'y'] } },
            names: { bsonType: 'array', items: { bsonType: 'string' } },
            ids: { bsonType: 'array', items: { bsonType: 'objectId' } },
            counter: { bsonType: 'number' },
            flag: { bsonType: 'bool' },
            label: { bsonType: 'string' },
            reason: { bsonType: ['string', 'null'] },
            tree: { bsonType: ['object', 'null'], properties: { child: { bsonType: ['object', 'null'] } } }
        });
        expect(properties).not.toHaveProperty('untyped');
        expect(required).toContain('amount');
        expect(required).not.toContain('reason');
        expect(required).not.toContain('level');
    });
});

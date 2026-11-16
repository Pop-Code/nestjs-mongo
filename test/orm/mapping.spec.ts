import 'reflect-metadata';

import { IsDate } from 'class-validator';
import { Decimal128, ObjectId } from 'mongodb';

import {
    cloneValue,
    convertTo,
    Field,
    getFieldsMetadata,
    hydrate,
    isBsonValue,
    isPlainObject,
    toDocument
} from '../../src';
import { merge } from '../../src/transformer/utils';
import { Address, Customer, Legacy, VipCustomer } from './entities';

class WithDesignType {
    @IsDate()
    at: Date;

    @Field()
    any?: unknown;
}

describe('hydrate', () => {
    it('should create the embedded documents and the ObjectIds from their decorators', () => {
        const ownerId = new ObjectId();
        const customer = hydrate(Customer, {
            _id: new ObjectId().toHexString(),
            name: 'Jane',
            ownerId: ownerId.toHexString(),
            address: { street: '1 main st', city: 'Paris' },
            addresses: [{ street: 'a', city: 'b' }, null],
            createdAt: '2026-01-02T00:00:00.000Z'
        });
        expect(customer).toBeInstanceOf(Customer);
        expect(customer._id).toBeInstanceOf(ObjectId);
        expect(customer.ownerId?.equals(ownerId)).toBe(true);
        expect(customer.address).toBeInstanceOf(Address);
        expect(customer.address?.label).toBe('1 main st, Paris');
        expect(customer.addresses?.[0]).toBeInstanceOf(Address);
        expect(customer.addresses?.[1]).toBeNull();
        expect(customer.createdAt).toBeInstanceOf(Date);
        expect(customer.createdAt.toISOString()).toBe('2026-01-02T00:00:00.000Z');
    });

    it('should keep the defaults of the class, and ignore the properties that start with __', () => {
        const customer = hydrate(Customer, { name: 'Jane', __hooks: ['injected'] });
        expect(customer.__hooks).toEqual([]);
        expect(customer.createdAt).toBeInstanceOf(Date);
    });

    it('should use the class-transformer decorators', () => {
        const legacy = hydrate(Legacy, {
            date: '2026-01-02T00:00:00.000Z',
            code: 'abc',
            secret: 'password',
            hiddenInOutput: 'kept',
            address: { street: 's', city: 'c' },
            plain: { nested: { value: 1 } }
        });
        expect(legacy.date).toBeInstanceOf(Date);
        expect(legacy.code).toBe('ABC');
        expect(legacy).not.toHaveProperty('secret');
        expect(legacy.hiddenInOutput).toBe('kept');
        expect(legacy.address).toBeInstanceOf(Address);
        expect(legacy.plain).toEqual({ nested: { value: 1 } });
    });

    it('should copy the plain objects of the source', () => {
        const source = { plain: { nested: { value: 1 } } };
        const legacy = hydrate(Legacy, source);
        legacy.plain!.nested.value = 2;
        expect(source.plain.nested.value).toBe(1);
    });

    it('should convert the Date properties from the design type', () => {
        const value = hydrate(WithDesignType, { at: '2026-01-02T00:00:00.000Z', any: { a: 1 } });
        expect(value.at).toBeInstanceOf(Date);
        expect(value.any).toEqual({ a: 1 });
    });

    it('should merge the field metadata of the parent classes', () => {
        expect(Object.keys(getFieldsMetadata(VipCustomer))).toEqual(
            expect.arrayContaining(['_id', 'address', 'addresses', 'ownerId'])
        );
    });
});

describe('convertTo', () => {
    it('should convert the primitive types', () => {
        expect(convertTo(String, 1)).toBe('1');
        expect(convertTo(Number, '2')).toBe(2);
        expect(convertTo(Boolean, 1)).toBe(true);
        expect(convertTo(undefined, { a: 1 })).toEqual({ a: 1 });
        expect(convertTo(Date, null)).toBeNull();
    });

    it('should keep the ObjectIds and convert their strings and bytes', () => {
        const id = new ObjectId();
        expect(convertTo(ObjectId, id)).toBe(id);
        expect((convertTo(ObjectId, id.id) as ObjectId).equals(id)).toBe(true);
        expect((convertTo(ObjectId, [id.toHexString()]) as ObjectId[])[0].equals(id)).toBe(true);
    });

    it('should throw for the values that can not be converted', () => {
        expect(() => convertTo(ObjectId, true)).toThrow(TypeError);
        expect(() => convertTo(Date, true)).toThrow(TypeError);
        expect(() => convertTo(ObjectId, 'not an id')).toThrow();
    });

    it('should copy the Dates', () => {
        const date = new Date();
        const converted = convertTo(Date, date);
        expect(converted).toEqual(date);
        expect(converted).not.toBe(date);
        expect(convertTo(Date, 0)).toEqual(new Date(0));
    });

    it('should not hydrate a value that is not a plain object', () => {
        const address = new Address();
        expect(convertTo(Address, address)).toBe(address);
    });
});

describe('toDocument', () => {
    it('should convert the class instances to plain objects', () => {
        const id = new ObjectId();
        const decimal = Decimal128.fromString('1.5');
        const customer = Object.assign(new Customer(), {
            _id: id,
            name: 'Jane',
            nickname: undefined,
            address: Object.assign(new Address(), { street: 's', city: 'c', zip: undefined }),
            tags: ['a', undefined],
            __hooks: ['x'],
            amount: decimal,
            raw: new Map([['a', 1]]),
            bytes: new Uint8Array([1]),
            pattern: /a/,
            fn: () => 1
        });
        const doc = toDocument(customer) as unknown as Record<string, unknown>;
        expect(Object.getPrototypeOf(doc)).toBe(Object.prototype);
        expect(doc._id).toBe(id);
        expect(doc).not.toHaveProperty('nickname');
        expect(doc).not.toHaveProperty('__hooks');
        expect(doc).not.toHaveProperty('fn');
        expect(doc.address).toEqual({ street: 's', city: 'c' });
        expect(Object.getPrototypeOf(doc.address)).toBe(Object.prototype);
        expect(doc.tags).toEqual(['a', null]);
        expect(doc.amount).toBe(decimal);
        expect(doc.raw).toBeInstanceOf(Map);
        expect(doc.bytes).toBeInstanceOf(Uint8Array);
        expect(doc.pattern).toBeInstanceOf(RegExp);
        expect(doc.createdAt).toEqual(customer.createdAt);
        expect(doc.createdAt).not.toBe(customer.createdAt);
    });
});

describe('helpers', () => {
    it('should detect the plain objects and the BSON values', () => {
        expect(isPlainObject({})).toBe(true);
        expect(isPlainObject(Object.create(null))).toBe(true);
        expect(isPlainObject(new Address())).toBe(false);
        expect(isPlainObject(null)).toBe(false);
        expect(isBsonValue(new ObjectId())).toBe(true);
        expect(isBsonValue({})).toBe(false);
        expect(isBsonValue(null)).toBe(false);
    });

    it('should deep copy the plain values only', () => {
        const id = new ObjectId();
        const value = { a: [{ b: 1 }], id, date: new Date(0) };
        const copy = cloneValue(value) as typeof value;
        expect(copy).toEqual(value);
        expect(copy.a[0]).not.toBe(value.a[0]);
        expect(copy.id).toBe(id);
        expect(copy.date).not.toBe(value.date);
    });
});

describe('merge', () => {
    it('should merge the sub objects, replace the arrays, set null and ignore undefined', () => {
        const customer = Object.assign(new Customer(), {
            name: 'Jane',
            nickname: 'J',
            tags: ['a', 'b'],
            address: Object.assign(new Address(), { street: 's', city: 'c' })
        });
        merge(customer, {
            name: undefined,
            nickname: null as unknown as string,
            tags: ['c'],
            address: { city: 'new' } as Address
        });
        expect(customer.name).toBe('Jane');
        expect(customer.nickname).toBeNull();
        expect(customer.tags).toEqual(['c']);
        expect(customer.address).toBeInstanceOf(Address);
        expect(customer.address).toMatchObject({ street: 's', city: 'new' });
    });

    it('should replace the dates and the ObjectIds', () => {
        const id = new ObjectId();
        const date = new Date(0);
        const customer = Object.assign(new Customer(), { ownerId: new ObjectId() });
        merge(customer, { ownerId: id, createdAt: date });
        expect(customer.ownerId).toBe(id);
        expect(customer.createdAt).toBe(date);
    });
});

describe('prototype pollution', () => {
    const payload = () =>
        JSON.parse('{"__proto__": {"polluted": true}, "constructor": {"prototype": {"polluted": true}}, "name": "x"}');

    afterEach(() => {
        expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });

    it('should not copy the prototype keys with merge', () => {
        const customer = merge(new Customer(), payload());
        expect(customer.name).toBe('x');
        expect(Object.getPrototypeOf(customer)).toBe(Customer.prototype);
        expect(Object.prototype.hasOwnProperty.call(customer, 'constructor')).toBe(false);
    });

    it('should not copy the prototype keys with hydrate, cloneValue and toDocument', () => {
        const customer = hydrate(Customer, payload(), []);
        expect(Object.getPrototypeOf(customer)).toBe(Customer.prototype);
        expect(Object.prototype.hasOwnProperty.call(customer, 'constructor')).toBe(false);
        const clone = cloneValue(payload()) as Record<string, unknown>;
        expect(Object.keys(clone)).toEqual(['name']);
        expect(Object.keys(toDocument(payload() as object))).toEqual(['name']);
    });
});

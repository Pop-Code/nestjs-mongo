import 'reflect-metadata';

import { ConflictException } from '@nestjs/common';

import { DuplicateKeyException, mapMongoError } from '../../src';

describe('mapMongoError', () => {
    it('should map the duplicate key errors', () => {
        const error = mapMongoError({ code: 11000, message: 'E11000', keyValue: { email: 'a' } });
        expect(error).toBeInstanceOf(DuplicateKeyException);
        expect(error).toBeInstanceOf(ConflictException);
        expect((error as DuplicateKeyException).keyValue).toEqual({ email: 'a' });
        expect((mapMongoError({ code: 11000 }) as DuplicateKeyException).message).toBe('Duplicate key');
    });

    it('should map the duplicate key errors of a bulk write', () => {
        const bulk = mapMongoError({ writeErrors: [{ code: 1 }, { code: 11000, err: { keyValue: { a: 1 } } }] });
        expect((bulk as DuplicateKeyException).keyValue).toEqual({ a: 1 });
        const flat = mapMongoError({ message: 'bulk', writeErrors: [{ code: 11000, keyValue: { b: 2 } }] });
        expect((flat as DuplicateKeyException).keyValue).toEqual({ b: 2 });
    });

    it('should return the other errors as they are', () => {
        const error = new Error('other');
        expect(mapMongoError(error)).toBe(error);
        expect(mapMongoError('string')).toBe('string');
        expect(mapMongoError(null)).toBeNull();
        const other = { writeErrors: [{ code: 2 }] };
        expect(mapMongoError(other)).toBe(other);
    });
});

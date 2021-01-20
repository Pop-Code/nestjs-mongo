import { RuntimeException } from '@nestjs/core/errors/exceptions/runtime.exception';
import slugify from 'slugify';

import { SlugDecorator } from '../decorators';

jest.mock('slugify', () => jest.fn((x) => x.trim()));

describe('Slug decorator', () => {
    test('should return property value if already set', () => {
        const target: any = {};
        SlugDecorator(target, 'slug', {});
        target.slug = 'slug-me-im-famous';

        expect(target.slug).toEqual('slug-me-im-famous');
        expect(target.__slug).toEqual('slug-me-im-famous');
    });

    test('should handle options.generate', () => {
        const target: any = { foo: 'bar' };

        SlugDecorator(target, 'slug', {
            generate: (obj: typeof target) => obj.foo
        });

        expect(target.slug).toEqual('bar');
        expect(target.__slug).toBeUndefined();
        expect(slugify).toHaveBeenCalled();
    });

    test('should handle options.keys', () => {
        const target: any = { firstName: 'John', lastName: 'Smith' };

        SlugDecorator<{ firstName: string; lastName: string }>(target, 'slug', {
            keys: ['firstName', 'lastName']
        });

        expect(target.slug).toEqual('John Smith');
        expect(target.__slug).toBeUndefined();
        expect(slugify).toHaveBeenCalled();
    });

    test('should throw RuntimeException if slugify fails', () => {
        const target: any = {};
        SlugDecorator(target, 'slug', {});
        expect(() => target.slug).toThrowError(RuntimeException);
    });
});

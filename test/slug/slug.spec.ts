import { plainToClass } from 'class-transformer';

import { EntitySlugTest } from './entity.slug';

describe('Slug decorator', () => {
    test('should handle options.generate and options.keys on plainToClass', () => {
        const target = plainToClass(EntitySlugTest, {
            firstName: 'John',
            lastName: 'Smith'
        });
        expect(target.slug).toEqual('john-smith');
        expect(target.slug2).toEqual('john-smith');
    });
});

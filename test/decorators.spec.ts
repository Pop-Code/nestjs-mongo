import { ObjectId } from 'bson';
import { plainToClass } from 'class-transformer';

import { EntityTest } from './module/entity';
import { EntityRelationship } from './module/entity.relationship';
import { EntitySlugTest } from './module/entity.slug';

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

describe('TypeObjectId decorator', () => {
    test('should keep ObjectId on plainToClass', () => {
        const target = plainToClass(EntityTest, {
            _id: new ObjectId()
        });
        expect(target._id).toBeInstanceOf(ObjectId);
    });
    test('should transform string to ObjectId on plainToClass', () => {
        const target = plainToClass(EntityTest, {
            _id: new ObjectId().toHexString()
        });
        expect(target._id).toBeInstanceOf(ObjectId);
    });
    test('should keep ObjectId on plainToClass with relationship type', () => {
        const target = plainToClass(EntityRelationship, {
            relationshipAsReference: new ObjectId()
        });
        expect(target.relationshipAsReference).toBeInstanceOf(ObjectId);
    });
    test('should transform string to ObjectId on plainToClass with relationship type', () => {
        const target = plainToClass(EntityRelationship, {
            relationshipAsReference: new ObjectId().toHexString()
        });
        expect(target.relationshipAsReference).toBeInstanceOf(ObjectId);
    });
});

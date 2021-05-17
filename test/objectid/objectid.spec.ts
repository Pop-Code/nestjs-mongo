import { ObjectId } from 'bson';
import { plainToClass } from 'class-transformer';

import { EntityTest } from '../entity/entity';
import { EntityRelationship } from '../relationship/entity.relationship';

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
            parentAsReference: new ObjectId()
        });
        expect(target.parentAsReference).toBeInstanceOf(ObjectId);
    });
    test('should transform string to ObjectId on plainToClass with relationship type', () => {
        const target = plainToClass(EntityRelationship, {
            parentAsReference: new ObjectId().toHexString()
        });
        expect(target.parentAsReference).toBeInstanceOf(ObjectId);
    });
});

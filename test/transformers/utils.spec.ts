import { ObjectId } from 'mongodb';

import { fromPlain, merge } from '../../src/transformer/utils';
import { EntityRelationship } from '../relationship/entity.relationship';

describe('fromPlain', () => {
    it('should transform a plain object to class', () => {
        const id = new ObjectId();
        const id2 = new ObjectId();
        const id3 = new ObjectId();
        const plain = {
            _id: id.toHexString(),
            property: 'bar',
            parent: id2,
            parentAsReference: id2,
            children: [id2, id3],
            childrenAsReference: [id2, id3]
        };

        const entity = fromPlain(EntityRelationship, plain);

        expect(entity).toBeInstanceOf(EntityRelationship);
        expect(entity._id).toBeInstanceOf(ObjectId);
        expect(entity._id?.equals(id)).toBe(true);
        expect(entity).toHaveProperty('property', plain.property);
        expect(entity.parent?.equals(id2)).toBe(true);
        expect(entity.parentAsReference?.equals(id2)).toBe(true);

        expect(entity.children).toHaveLength(2);
        if (entity.children === undefined) {
            throw new Error('Children are empty !');
        }
        expect(entity.children[0]).toBeInstanceOf(ObjectId);
        expect(entity.children[0].equals(id2)).toBe(true);
        expect(entity.children[1]).toBeInstanceOf(ObjectId);
        expect(entity.children[1].equals(id3)).toBe(true);

        expect(entity.childrenAsReference).toHaveLength(2);
        if (entity.childrenAsReference === undefined) {
            throw new Error('Children are empty !');
        }
        expect(entity.childrenAsReference[0]).toBeInstanceOf(ObjectId);
        expect(entity.childrenAsReference[0].equals(id2)).toBe(true);
        expect(entity.childrenAsReference[1]).toBeInstanceOf(ObjectId);
        expect(entity.childrenAsReference[1].equals(id3)).toBe(true);
    });
});

describe('merge', () => {
    it('should merge an object into a class', () => {
        const id = new ObjectId();
        const id2 = new ObjectId();
        const id3 = new ObjectId();

        const entity1 = new EntityRelationship();
        entity1._id = id;
        entity1.property = 'test';
        entity1.children = [id2, id3];
        entity1.__shouldBeExcluded = 'shouldbeexcluded';

        const entity2 = new EntityRelationship();
        entity2.property = 'bad';
        entity2.__shouldBeExcluded = 'shouldbeexcluded';

        merge(entity2, entity1, ['__']);

        expect(entity1._id.equals(id)).toBe(true);
        expect(entity1).toHaveProperty('property', 'test');
        expect(entity1.children).toHaveLength(2);
        if (entity1.children === undefined) {
            throw new Error('Children are empty !');
        }
        expect(entity1.children[0].equals(id2)).toBe(true);
        expect(entity1.children[1].equals(id3)).toBe(true);

        expect(entity2).toHaveProperty('_id');
        expect(entity2._id.equals(id)).toBe(true);
        expect(entity2).toHaveProperty('property', entity1.property);
        expect(entity2.children).toHaveLength(entity1.children.length);
        if (entity2.children === undefined) {
            throw new Error('Children are empty !');
        }
        expect(entity2.children[0].equals(id2)).toBe(true);
        expect(entity2.children[1].equals(id3)).toBe(true);
        expect(entity2).toHaveProperty('__shouldBeExcluded', undefined);
    });
});

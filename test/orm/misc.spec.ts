import 'reflect-metadata';

import { Exclude } from 'class-transformer';
import { IsString } from 'class-validator';

import { Collection, Entity, getIndexMetadatas, Index, InjectEntityRepository, InjectRepository } from '../../src';
import { Person } from './entities';

@Collection('ormSerialized')
class Serialized extends Entity {
    @IsString()
    name: string;

    @Exclude()
    password?: string;

    @Exclude({ toClassOnly: true })
    visibleInOutput?: string;

    @Exclude()
    get secret() {
        return 'secret';
    }

    get upperName() {
        return this.name.toUpperCase();
    }
}

describe('toJSON', () => {
    it('should remove the @Exclude() properties and getters, and keep the other getters', () => {
        const entity = Object.assign(new Serialized(), { name: 'n', password: 'p', visibleInOutput: 'v' });
        const json = entity.toJSON();
        expect(json).toMatchObject({ name: 'n', upperName: 'N', visibleInOutput: 'v' });
        expect(json).not.toHaveProperty('password');
        expect(json).not.toHaveProperty('secret');
        expect(entity.serialize()).not.toHaveProperty('password');
    });
});

describe('@Index()', () => {
    it('should declare the class indexes', () => {
        expect(getIndexMetadatas(Person)).toEqual(
            expect.arrayContaining([
                { property: undefined, description: { key: { lastName: 1, firstName: -1 }, name: 'person_name' } }
            ])
        );
    });

    it('should require a key on a class', () => {
        expect(() => Index({ unique: true })(class NoKey {})).toThrow('@Index() on the class NoKey requires a "key"');
    });
});

describe('injection', () => {
    it('should alias InjectRepository', () => {
        expect(InjectRepository).toBe(InjectEntityRepository);
    });
});

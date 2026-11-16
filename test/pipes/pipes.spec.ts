import 'reflect-metadata';

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ObjectId } from 'mongodb';

import { EntityManager, ObjectIdPipe, RelationshipPipe, RequiredRelationshipPipe } from '../../src';
import { EntityTest } from '../entity/entity';

const metadata = { type: 'param' as const, metatype: EntityTest, data: 'id' };

const emReturning = (value: any) => ({ findOne: async () => value }) as unknown as EntityManager;

describe('ObjectIdPipe', () => {
    it('should transform a string to an ObjectId', async () => {
        const id = new ObjectId();
        const result = await new ObjectIdPipe().transform(id.toHexString(), metadata);
        expect(result).toBeInstanceOf(ObjectId);
        expect(result.equals(id)).toBe(true);
    });
    it('should throw a BadRequestException on a malformed id', async () => {
        await expect(new ObjectIdPipe().transform('nope', metadata)).rejects.toBeInstanceOf(BadRequestException);
    });
});

describe('RelationshipPipe', () => {
    it('should return the entity', async () => {
        const entity = new EntityTest();
        const result = await new RelationshipPipe(emReturning(entity)).transform(
            new ObjectId().toHexString(),
            metadata
        );
        expect(result).toBe(entity);
    });
    it('should return undefined when the entity does not exist', async () => {
        const result = await new RelationshipPipe(emReturning(undefined)).transform(
            new ObjectId().toHexString(),
            metadata
        );
        expect(result).toBeUndefined();
    });
});

describe('RequiredRelationshipPipe', () => {
    it('should throw a NotFoundException when the entity does not exist', async () => {
        const id = new ObjectId().toHexString();
        const pipe = new RequiredRelationshipPipe(emReturning(undefined));
        await expect(pipe.transform(id, metadata)).rejects.toThrow(new NotFoundException(`EntityTest:${id} not found`));
    });
});

describe('EntityManager query helpers', () => {
    const em = new EntityManager({} as any, {} as any, (e) => e);
    it('should detect an id query', () => {
        expect(em.isIdQuery({ _id: new ObjectId() })).toBe(true);
        expect(em.isIdQuery({ _id: new ObjectId(), foo: 'bar' })).toBe(false);
    });
    it('should detect an ids query', () => {
        expect(em.isIdsQuery({ _id: { $in: [new ObjectId()] } })).toBe(true);
        expect(em.isIdsQuery({ _id: new ObjectId() })).toBe(false);
    });
});
